import React from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  Platform,
  TextInput,
  Alert,
  Button,
  Dimensions
} from 'react-native'
import BleModule from './BleModule';
import AsyncStorage from '@react-native-community/async-storage';
//import { stringToBytes } from 'convert-string';
import firestore, { firebase } from '@react-native-firebase/firestore';
import BackgroundFetch from "react-native-background-fetch";
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
const width = Dimensions.get('screen').width;
const height = Dimensions.get('screen').height;
global.BluetoothManager = new BleModule();
export default class Home extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      scaning: false,
      isConnected: false,
      text: '',
      writeData: '',
      receiveData: '',
      readData: '',
      isMonitoringTop: false,
      isMonitoringBtm:false,
      rssi: '',
      sum: 0,
      n: 0,
      uid: '',
      isWearing: true,
      phoneNearby: true,
      latestTop:0.0,
    }
    this.bluetoothReceiveDataTop = [];  //蓝牙接收的数据缓存
    this.bluetoothReceiveDataBtm = []; 
    this.latestBtm=0.0;
   // this.latestTop=0.0;
    this.deviceMap = new Map();
  }

  async componentDidMount() {
    BluetoothManager.start();  //蓝牙初始化     	    
    this.updateStateListener = BluetoothManager.addListener('BleManagerDidUpdateState', this.handleUpdateState);
    this.stopScanListener = BluetoothManager.addListener('BleManagerStopScan', this.handleStopScan);
    this.discoverPeripheralListener = BluetoothManager.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral);
    this.connectPeripheralListener = BluetoothManager.addListener('BleManagerConnectPeripheral', this.handleConnectPeripheral);
    this.disconnectPeripheralListener = BluetoothManager.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectPeripheral);
    this.updateValueListener = BluetoothManager.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValue);
    

    BackgroundFetch.configure({
      minimumFetchInterval: 15,     // <-- minutes (15 is minimum allowed)
      forceAlarmManager: false,     // <-- Set true to bypass JobScheduler.
      stopOnTerminate: true,
      startOnBoot: false,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY, // Default
    }, async (taskId) => {
      console.log("[js] Received background-fetch event: ", taskId);
      Location.getCurrentPositionAsync({ accuracy: 4 }).then(async (data) => {
        let distDiff = getDistance({ latitude: data.coords.latitude, longitude: data.coords.longitude, }, JSON.parse(await AsyncStorage.getItem('LatLng')));
        let uid = await AsyncStorage.getItem("uid");

        if (this.state.phoneNearby && !this.state.isConnected) {
          this.setState({phoneNearby:false});
          firestore()
            .collection('UserInfo').doc(uid).update({ phoneNearby: false, lastUpdate:new Date(), });
          let timeNow = new Date().getTime();
          firestore()
            .collection('checkDevice').doc(uid + "_" + timeNow).set({
              timestamp: timeNow,
              estimatedDist: 999,
              date: "" + new Date(),
            });
        }
        if (distDiff > 100) {
          firestore()
            .collection('UserInfo').doc(uid).update({
              isHome: false,
              lastUpdate:new Date(),
            });
          let timeNow = new Date().getTime();
          firestore()
            .collection('checkPosition').doc(uid + "_" + timeNow).set({
              dist: distDiff,
              latNow: data.coords.latitude,
              lngNow: data.coords.longitude,
              timestamp: timeNow,
              date: new Date(),

            });
        }
        else {
          firestore()
            .collection('UserInfo').doc(uid).update({
              isHome: true,
              lastUpdate:new Date(),
            });
        }

      }
      )
      if (this.bluetoothReceiveDataBtm.length>1){
        var endTime= new Date();
        var startTime= endTime.getTime()-1000*this.bluetoothReceiveDataBtm.length;
        var date="From:"+new Date(startTime).toLocaleString()+"To:"+ endTime.toLocaleString();
       await  firestore()
        .collection('bodyTemp').doc(this.state.uid+"_"+endTime.getTime()).set({
          data: JSON.stringify(this.bluetoothReceiveDataBtm),
          startTime:startTime,
          endTime:endTime.getTime(),
          date:date,
        });
        this.bluetoothReceiveDataBtm=[];
      }

      

      BackgroundFetch.finish(taskId);
    }, (error) => {
      console.log("[js] RNBackgroundFetch failed to start");
    });
    BackgroundFetch.status((status) => {
      switch (status) {
        case BackgroundFetch.STATUS_RESTRICTED:
          console.log("BackgroundFetch restricted");
          break;
        case BackgroundFetch.STATUS_DENIED:
          console.log("BackgroundFetch denied");
          break;
        case BackgroundFetch.STATUS_AVAILABLE:
          console.log("BackgroundFetch is enabled");
          break;
      }
    });

  }

  componentWillUnmount() {
    if(this.state.uid==null)
      return;
    this.updateStateListener.remove();
    this.stopScanListener.remove();
    this.discoverPeripheralListener.remove();
    this.connectPeripheralListener.remove();
    this.disconnectPeripheralListener.remove();
    this.updateValueListener.remove();
    if (this.state.isConnected) {
      BluetoothManager.disconnect();  //退出时断开蓝牙连接
    }
  }

  //蓝牙状态改变
  handleUpdateState = (args) => {
    console.log('BleManagerDidUpdateStatea:', args);
    BluetoothManager.bluetoothState = args.state;
    if (args.state == 'on') {  //蓝牙打开时自动搜索
      // this.scan();
    }
  }
  //扫描结束监听
  handleStopScan = () => {
    console.log('BleManagerStopScan:', 'Scanning is stopped');
    this.setState({ scaning: false });
  }
  //搜索到一个新设备监听
  handleDiscoverPeripheral = (data) => {
    // console.log('BleManagerDiscoverPeripheral:', data);
    //console.log(data.id, data.name);
    let id;  //蓝牙连接id
    let macAddress;  //蓝牙Mac地址           
    if (Platform.OS == 'android') {
      macAddress = data.id;
      id = macAddress;
    } else {
      //ios连接时不需要用到Mac地址，但跨平台识别同一设备时需要Mac地址
      //如果广播携带有Mac地址，ios可通过广播0x18获取蓝牙Mac地址，
      macAddress = BluetoothManager.getMacAddressFromIOS(data);
      id = data.id;
    }
    this.deviceMap.set(data.id, data);  //使用Map类型保存搜索到的蓝牙设备，确保列表不显示重复的设备
    this.setState({ data: [...this.deviceMap.values()] });
  }

  //蓝牙设备已连接 
  handleConnectPeripheral = async (args) => {
    this.setState({ uid: await AsyncStorage.getItem("uid") }, async () => {
      if (this.state.uid!=null){
      
      let data = await firestore()
        .collection('UserInfo').doc(this.state.uid).get();
      this.setState({ isWearing: data._data.isWearing });
      this.setState({ phoneNearby: data._data.phoneNearby });
      }
    });
    console.log('BleManagerConnectPeripheral:', args);
  }

  //蓝牙设备已断开连接
  handleDisconnectPeripheral = (args) => {
    console.log('BleManagerDisconnectPeripheral:', args);
    let newData = [...this.deviceMap.values()]
    BluetoothManager.initUUID();  //断开连接后清空UUID
    this.setState({
      data: newData,
      isConnected: false,
      writeData: '',
      readData: '',
      receiveData: '',
      text: '',
      isFetching: false,
    });
  }
  handlePhoneNearby = async (calDist) => {
    let uid = await AsyncStorage.getItem("uid");
    if (this.state.phoneNearby && calDist > 12) // too far
    {
      this.setState({ phoneNearby: false });
      firestore()
        .collection('UserInfo').doc(uid).update({ phoneNearby: false, lastUpdate:new Date(), });
      let timeNow = new Date().getTime();
      firestore()
        .collection('checkDevice').doc(uid + "_" + timeNow).set({
          timestamp: timeNow,
          estimatedDist: calDist,
          date: "" + new Date(),
        });
    }
    else if (!this.state.phoneNearby && calDist <= 12) {
      this.setState({ phoneNearby: true });
      firestore()
        .collection('UserInfo').doc(uid).update({ phoneNearby: true, lastUpdate:new Date(), });

    }
  }
  handleIsWearing = async (temp) => {
    let uid = await AsyncStorage.getItem("uid");
    if (temp > 32.5 && temp < 41) {
      if (!this.state.isWearing) {
        this.setState({ isWearing: true });
        firestore()
          .collection('UserInfo').doc(uid).update({ isWearing: true, lastUpdate:new Date(), });
      }

    }
    else if (temp <= 32.5 || temp >= 41) {
      if (this.state.isWearing) {
        this.setState({ isWearing: false });
        firestore()
          .collection('UserInfo').doc(uid).update({ isWearing: false, lastUpdate:new Date(), });
        let timeNow = new Date().getTime();
        firestore()
          .collection('checkWearing').doc(uid + "_" + timeNow).set({
            timestamp: timeNow,
            date: "" + new Date(),
          });

          if (this.bluetoothReceiveDataBtm.length>1){
            var endTime= new Date();
            var startTime= endTime.getTime()-1000*this.bluetoothReceiveDataBtm.length;
            var date="From:"+new Date(startTime).toLocaleString()+"To:"+ endTime.toLocaleString();
           await  firestore()
            .collection('bodyTemp').doc(uid+"_"+endTime.getTime()).set({
              data: JSON.stringify(this.bluetoothReceiveDataBtm),
              startTime:startTime,
              endTime:endTime.getTime(),
              date:date,
            });
            this.bluetoothReceiveDataBtm=[];
          }
      }

    }
  }
  handleUpdateValue = async (data) => {
    //ios接收到的是小写的16进制，android接收的是大写的16进制，统一转化为大写16进制
    //console.log(this.state.data[0],this.state.data[0].id);
    var value=data.value;
   // var tempStr = "";
    if (data.characteristic=="3544531b-00c3-4342-9755-b56abe8e6a66"){
      //console.log(252,data);
      this.latestBtm=value[1]+value[0]/256;
      this.latestBtm=parseFloat(this.latestBtm.toFixed(2));
      if (!this.state.isFetching)
        BluetoothManager.readRSSI("03:00:00:51:3C:7D").then(
          async (data) => {
          let tempSum = this.state.sum;
          let tempN = this.state.n + 1;
          this.setState({
            sum: tempSum + ((data - tempSum) / (tempN)), n: tempN
          }, async () => {
            let calDist = this.calculateDistance(0.75 * data + 0.25 * this.state.sum);
            //console.log(calDist,this.state.phoneNearby);
            this.handlePhoneNearby(calDist);
          });
          this.setState({ isFetching: false, rssi: "RSSI: " + data });
        }
      );
    this.setState({ isFetching: true })
    if (this.state.isWearing)
      this.bluetoothReceiveDataBtm.push(this.latestBtm);
    this.handleIsWearing(this.latestBtm);
    }
    else 
     {

    // console.log(276)
      let tempTop=value[1]+value[0]/256;
      tempTop=parseFloat(tempTop.toFixed(2));
      this.setState({latestTop:tempTop})
      this.bluetoothReceiveDataTop.push(tempTop);
      //this.setState({ isFetching: true });

   
     }
    //this.bluetoothReceiveData.push(value);
   // value.forEach(element => {
     // tempStr = tempStr + String.fromCharCode(element);
  //  });
    //this.bluetoothReceiveData = [];
    

    // this.bluetoothReceiveData.push(tempStr);
    
    // console.log('BluetoothUpdateValue', tempStr);
 
    //this.setState({ receiveData: this.bluetoothReceiveData })

  }
  connect(item) {
    //当前蓝牙正在连接时不能打开另一个连接进程
    if (BluetoothManager.isConnecting) {
      console.log('Cannot connect multiple BLE servers at a time.');
      return;
    }
    if (this.state.scaning) {  //当前正在扫描中，连接时关闭扫描
      BluetoothManager.stopScan();
      this.setState({ scaning: false });
    }
    let newData = [...this.deviceMap.values()]
    newData[item.index].isConnecting = true;
    this.setState({ data: newData });
    console.log(newData);
    BluetoothManager.connect(item.item.id)
      .then(peripheralInfo => {
        let newData = [...this.state.data];
        newData[item.index].isConnecting = false;
        //连接成功，列表只显示已连接的设备
        this.setState({
          data: [item.item],
          isConnected: true
        });
        BluetoothManager.isConnected = true;
      })
      .catch(err => {
        let newData = [...this.state.data];
        newData[item.index].isConnecting = false;
        this.setState({ data: newData });
        this.alert('Connection failed');
      })
  }

  disconnect() {
    this.setState({
      data: [...this.deviceMap.values()],
      isConnected: false
    });
    BluetoothManager.isConnected = false;
    BluetoothManager.disconnect();
  }

  scan() {

    if (this.state.scaning) {  //当前正在扫描中
      BluetoothManager.stopScan();
      this.setState({ scaning: false });
    }
    if (BluetoothManager.bluetoothState == 'on') {
      BluetoothManager.scan()
        .then(() => {
          this.setState({ scaning: true });
        }).catch(err => {

        })
    } else {
      BluetoothManager.checkState();
      if (Platform.OS == 'ios') {
        this.alert('Please turn on bluetooth');
      } else {
        Alert.alert('Reminder:', 'Please turn on bluetooth', [
          {
            text: 'Cancel',
            onPress: () => { }
          },
          {
            text: 'Turn On',
            onPress: () => { BluetoothManager.enableBluetooth() }
          }
        ]);
      }

    }
  }


  alert(text) {
    Alert.alert('Reminder: ', text, [{ text: 'Confirm', onPress: () => { } }]);
  }

  write = (index) => {
    if (this.state.text.length == 0) {
      this.alert('Please input message');
      return;
    }
    BluetoothManager.write(this.state.text, index)
      .then(() => {
        this.bluetoothReceiveData = [];
        this.setState({
          writeData: this.state.text,
          text: '',
        })
      })
      .catch(err => {
        this.alert('Failed to send');
      })
  }

  writeWithoutResponse = (index) => {
    if (this.state.text.length == 0) {
      this.alert('Please input message');
      return;
    }
    BluetoothManager.writeWithoutResponse(this.state.text, index)
      .then(() => {
        this.bluetoothReceiveData = [];
        this.setState({
          writeData: this.state.text,
          text: '',
        })
      })
      .catch(err => {
        this.alert('Failed to send');
      })
  }

  read = (index) => {
    BluetoothManager.read(index)
      .then(data => {
        this.setState({ readData: data });
      })
      .catch(err => {
        this.alert('Failed to read');
      })
  }
  notify = (index) => {
    //console.log(404,index);
    BluetoothManager.startNotification(index)
      .then(() => {
       // this.setState({ isMonitoring: true });
        if (index==0)
          this.setState({isMonitoringTop:true})
        else this.setState({isMonitoringBtm:true});
        if (this.state.isMonitoringTop)
          this.alert('Top Sensor monitoring started.');
        else  this.alert('Bottom Sensor monitoring started.');
      })
      .catch(err => {
        console.log(err);
        this.setState({ isMonitoring: false });
        this.alert('Notifation failed');
      })
  }

  calculateDistance = (rssi) => {
    var txPower = -62 //hard coded power value. Usually ranges between -59 to -65
    if (rssi == 0) {
      return -1.0;
    }
    var ratio = rssi * 1.0 / txPower;
    if (ratio < 1.0) {
      return Math.pow(ratio, 10);
    }
    else {
      var distance = (0.89976) * Math.pow(ratio, 7.7095) + 0.111;
      return distance;
    }
  }

  renderItem = (item) => {
    let data = item.item;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={this.state.isConnected ? true : false}
        onPress={() => { this.connect(item) }}
        style={styles.item}>

        <View style={{ flexDirection: 'row', }}>
          <Text style={{ color: 'black' }}>{data.name ? data.name : ''}</Text>
          <Text style={{ marginLeft: 50, color: "red" }}>{data.isConnecting ? 'Connecting...' : ''}</Text>
        </View>
        <Text>{data.id}</Text>
        <Text>{this.state.rssi}</Text>
      </TouchableOpacity>
    );
  }

  renderHeader = () => {

    return (
      <View style={{ marginTop: 20 }}>

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.buttonView, { marginHorizontal: 10, height: 40, alignItems: 'center' }]}
          onPress={this.state.isConnected ? this.disconnect.bind(this) : this.scan.bind(this)}>
          <Text style={styles.buttonText}>{this.state.scaning ? 'Now Searching' : this.state.isConnected ? 'Disconnect Device' : 'Search Device'}</Text>
        </TouchableOpacity>

        <Text style={{ marginLeft: 10, marginTop: 10 }}>
          {this.state.isConnected ? 'Current connected device' : 'Available devices'}
        </Text>
      </View>
    )
  }

  renderFooter = () => {
    return (
      <View style={{ marginBottom: 30 }}>
        {this.state.isConnected ?
          <View >
            {this.renderReceiveView('Current Status：', 'Start Measuring' , BluetoothManager.nofityCharacteristicUUID, this.notify, this.state.receiveData)}
            <View style={{ paddingHorizontal: 10, borderRadius: 5}}>
              <Button title='stop measuring top' onPress={() => {
                console.log(this.bluetoothReceiveDataTop);
                BluetoothManager.stopNotification(0)
                  .then(() => {
                    this.bluetoothReceiveDataTop=[];
                    this.setState({ isMonitoringTop: false })
                    //console.log("bubu")
                  })
                  .catch(err => {

                    this.alert('Failed to turn off');
                  })   
              }} />
              <Button title='stop measuring bottom' onPress={ () => {
      
                BluetoothManager.stopNotification(1)
                  .then(async() => {
                    let uid = await AsyncStorage.getItem("uid");
                    if (this.bluetoothReceiveDataBtm.length>1){
                    var endTime= new Date();
                    var startTime= endTime.getTime()-1000*this.bluetoothReceiveDataBtm.length;
                    var date="From:"+new Date(startTime).toLocaleString()+"To:"+ endTime.toLocaleString();
                   await  firestore()
                    .collection('bodyTemp').doc(uid+"_"+endTime.getTime()).set({
                      data: JSON.stringify(this.bluetoothReceiveDataBtm),
                      startTime:startTime,
                      endTime:endTime.getTime(),
                      date:date,
                    });
                    this.bluetoothReceiveDataBtm=[];  
                    this.setState({ isMonitoringBtm: false })
                  }
                    //console.log("bubu")}
                  })
                  .catch(err => {
                    console.log(err);
                    this.alert('Failed to turn off');
                  })   
              }} />
            </View>
            <Text style={{ fontSize: 20 }}>Your Body Temperature:</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>Top Sensor:</Text>
              <Text style={{ fontSize: 40, color: 'red' }}>{this.state.latestTop}°C</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 20 }}>Bottom Sensor:</Text>
              <Text style={{ fontSize: 40, color: 'red' }}>{this.latestBtm}°C</Text>
            </View>

            {/*{this.renderWriteView('Write Data(write)：', 'Send', BluetoothManager.writeWithResponseCharacteristicUUID, this.write, this.state.writeData)}
            {this.renderWriteView('(writeWithoutResponse)：', 'Send', BluetoothManager.writeWithoutResponseCharacteristicUUID, this.writeWithoutResponse, this.state.writeData)}
            {this.renderReceiveView('Read Data：', 'Read', BluetoothManager.readCharacteristicUUID, this.read, this.state.readData)}
                */}

          </View>
          : <View></View>
        }
      </View>
    )
  }

  renderReceiveView = (label, buttonText, characteristics, onPress, state) => {
    if (characteristics.length == 0) {
      return;
    }
    if (this.state.isMonitoringTop&&this.state.isMonitoringBtm)
    var outLabel=label+ "Both on";
  else if (this.state.isMonitoringTop&&!this.state.isMonitoringBtm)
    var outLabel=label+"Top on; Bottom off";
  else if (!this.state.isMonitoringTop&&this.state.isMonitoringBtm)
    var outLabel=label+"Top off; Bottom on";
  else  var outLabel=label+"Both off";
    return (
      <View style={{ marginHorizontal: 10, marginTop: 5 }}>

        {characteristics.map((item, index) => {
          if (index==1 || index ==0){
            {
            if (index==0 )
              {
                if (this.state.isMonitoringTop)
                  var outText= buttonText+"(Top sensor)";
                  else var outText= "Click to start measure (Top sensor)";
              }
            else 
              {
                if (this.state.isMonitoringBtm)
                  
                  var outText =buttonText+"(Bottom sensor)";
                  else var outText= "Click to start measure (Bottom sensor)";
              }   
            
            }
          

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.buttonView}
              onPress={() => onPress(index)}
              key={index}>
              <Text style={styles.buttonText}>{outText}</Text>
            </TouchableOpacity>
          )
        }
        })}
        
        <Text style={{ color: 'black', marginTop: 5 }}>{outLabel}</Text>
      </View>
    )
  }

  renderWriteView = (label, buttonText, characteristics, onPress, state) => {
    if (characteristics.length == 0) {
      return;
    }
    return (
      <View style={{ marginHorizontal: 10, marginTop: 30 }} behavior='padding'>
        <Text style={{ color: 'black' }}>{label}</Text>
        <Text style={styles.content}>
          {this.state.writeData}
        </Text>
        {characteristics.map((item, index) => {
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              style={styles.buttonView}
              onPress={() => { onPress(index) }}>
              <Text style={styles.buttonText}>{buttonText} ({item})</Text>
            </TouchableOpacity>
          )
        })}
        <TextInput
          style={[styles.textInput]}
          value={this.state.text}
          placeholder='Please input message'
          onChangeText={(text) => {
            this.setState({ text: text });
          }}
        />
      </View>
    )
  }

  render() {
    return (
      <View style={styles.container}>
        <FlatList
          renderItem={this.renderItem}
          ListHeaderComponent={this.renderHeader}
          ListFooterComponent={this.renderFooter}
          keyExtractor={item => item.id}
          data={this.state.data}
          extraData={[this.state.isConnected, this.state.text, this.state.receiveData, this.state.readData, this.state.writeData, this.state.isMonitoring, this.state.scaning]}
          keyboardShouldPersistTaps='handled'
        />
      </View>
    )
  }
}

const styles = StyleSheet.create({

  container: {
    width: width * 0.95, 
    height: height * 0.83, 
    borderRadius: 10, 
    padding: 5, 
    alignSelf: 'center', 
    marginTop: 8, 
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.41,
    shadowRadius: 9.11,
    elevation: 4,
    
  },
  item: {
    flexDirection: 'column',
    borderColor: 'rgb(235,235,235)',
    borderStyle: 'solid',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 10,
    paddingVertical: 8,
  },
  buttonView: {
    height: 30,
    backgroundColor: 'rgb(33, 150, 243)',
    paddingHorizontal: 10,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: 'center',
    alignItems: 'flex-start',
    marginTop: 10
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    alignSelf: 'center',
    alignItems: 'center',
  },
  content: {
    marginTop: 5,
    marginBottom: 5,
  },
  textInput: {
    paddingLeft: 5,
    paddingRight: 5,
    backgroundColor: 'white',
    height: 50,
    fontSize: 16,
    flex: 1,
  },
})
