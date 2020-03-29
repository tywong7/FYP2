import 'react-native-gesture-handler';
import * as React from 'react';
import {
  AppState, Modal, Alert, View, Text, Button, StyleSheet, Dimensions, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBiometrics from 'react-native-biometrics'
import { createStackNavigator } from '@react-navigation/stack';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import firestore, { firebase } from '@react-native-firebase/firestore';
import { getDistance } from 'geolib';
import * as Permissions from 'expo-permissions';
import * as Location from 'expo-location';
import Settings from './screen/Settings'
import Home from './screen/Home'
import About from './screen/About'
const width = Dimensions.get('screen').width;
const height = Dimensions.get('screen').height;
const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
async function requestGPSPermission({ navigation }) {

  try {
    let { status } = await Permissions.askAsync(Permissions.LOCATION);
    console.log(status);
    if (status !== 'granted') {
      Alert.alert("Sorry", "Please grant the permission to continue.");

    }
    else
      navigation.navigate('Step 2');

  } catch (err) {
    console.warn(err);
  }
}
function PermissionScreen({ navigation }) {
  return (
    <View style={{
      flex: 1, alignItems: 'center', justifyContent: 'center',
      width: width * 0.95,
      height: height * 0.80,
      borderRadius: 10,
      padding: 5,
      alignSelf: 'center',
      marginVertical: 8,
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 7,
      },
      shadowOpacity: 0.41,
      shadowRadius: 9.11,
      elevation: 4,
    }}>

      <Text style={{ fontSize: 30 }}>
        Welcome to this app
      </Text>
      <Text>Step 1: Grant Location Access</Text>
      <Button title={'GRANT ACCESS'} onPress={() => { requestGPSPermission({ navigation }) }}></Button>
    </View>
  );
}


function MyTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Measure" component={Home} options={{
        tabBarIcon: ({ color, size }) => (
          <Icon name="thermometer" color={color} size={size} />
        ),
      }} />
      <Tab.Screen name="Settings" component={Settings} options={{

        tabBarIcon: ({ color, size }) => (
          <Icon name="tune" color={color} size={size} />
        ),
      }} />
      <Tab.Screen name="About" component={About} options={{

        tabBarIcon: ({ color, size }) => (
          <Icon name="information" color={color} size={size} />
        ),
      }} />
    </Tab.Navigator>
  );
}

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      passed: true,
      modalVisible: false,
      appState: AppState.currentState,
      firstRun: false,
      latlng: null,
      loading: [],
    };
  }

  AddressScreen = ({ navigation }) => {
    var tempSize = 28
    return (
      <View style={{
        width: width * 0.95,
        height: height * 0.82,
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
      }} >
        <View style={{ position: 'absolute', width: width * 0.95, zIndex: 9999 }}>
          <GooglePlacesAutocomplete
            placeholder='Your Address'
            minLength={2} // minimum length of text to search
            autoFocus={false}
            returnKeyType={'search'} // Can be left out for default return key https://facebook.github.io/react-native/docs/textinput.html#returnkeytype
            keyboardAppearance={'light'} // Can be left out for default keyboardAppearance https://facebook.github.io/react-native/docs/textinput.html#keyboardappearance
            listViewDisplayed='false'    // true/false/undefined
            fetchDetails={true}
            renderDescription={row => row.description} // custom description render
            onPress={async (data, details = null) => { // 'details' is provided when fetchDetails = true
              this.setState({})

              AsyncStorage.setItem('FullAddr', data.description);
              AsyncStorage.setItem('LatLng', JSON.stringify(details.geometry.location));

              navigation.navigate('Welcome');
            }}

            getDefaultValue={() => ''}
            query={{
              // available options: https://developers.google.com/places/web-service/autocomplete
              key: '***',
              language: 'en' // default: 'geocode'

            }}
            styles={{

              textInputContainer: {
                backgroundColor: 'rgba(1.0,1.0,1.0,0.7)',
                borderTopWidth: 0,
                borderBottomWidth: 0
              },
              listView: {
                backgroundColor: 'rgba(1.0,1.0,1.0,0.2)',

              }
              ,
              description: {
                fontWeight: 'bold'
              },
              predefinedPlacesDescription: {
                color: '#1faadb'
              }
            }}

          />

        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginBottom: height * 0.3 }}>
          <Text style={{ fontSize: 20 }}>⬆️⬆️⬆️⬆️</Text>
          <Text style={{ fontSize: 20 }}>

            Please input your address above.
              </Text>
          {this.state.loading}
        </View>




      </View>
    );
  }

  WelcomeScreen = ({ navigation }) => {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', width: width * 0.95,
        height: height * 0.8,
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
      }}>
        <Text style={{ fontSize: 18 }}>
          All settings are complete, thank you for using this app.
        </Text>
        <View>
          <Button title="Proceed" onPress={async () => {
            const querySnapshot = await firebase.firestore()
              .collection('UserInfo').doc('totalUser').get();
            let number = querySnapshot.data().total + 1;
            let uid = 'user_' + number;
            let description = await AsyncStorage.getItem('FullAddr');
            let location = JSON.parse(await AsyncStorage.getItem('LatLng'));
            firestore()
              .collection('UserInfo').doc('totalUser').set({
                total: number
              });
            firestore()
              .collection('UserInfo').doc(uid).set({
                fullAddr: description,
                lat: location.lat,
                lng: location.lng,
                isHome: true,
                isWearing: true,
                phoneNearby: true,
                lastUpdate:new Date(),
              });
            AsyncStorage.setItem('uid', uid);
            AsyncStorage.setItem('initialRun', 'false');
            this.setState({ firstRun: false });
          }} />
        </View>
      </View>
    );
  }
  async componentDidMount() {

    AppState.addEventListener('change', this._handleAppStateChange);
    let init = await AsyncStorage.getItem('initialRun');
    if (init == null) {
      this.setState({ firstRun: true });

    }
    else {


      //this.setState({latlng:JSON.parse(await AsyncStorage.getItem('LatLng'))});
    }
    try {
      await Location.getCurrentPositionAsync({ accuracy: 4 });

    }
    catch (err) {

      Alert.alert("Permission Denied", "Please enable location.")
    }

  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this._handleAppStateChange);
  }

  _handleAppStateChange = async (nextAppState) => {
    if (this.state.firstRun)
      return;
    if (
      this.state.appState.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      var ranNum = Math.floor(Math.random() * 101) % 10;
      if (!this.state.passed) {
        ranNum = 0;
        this.setState({ passed: true });
      }
      if (ranNum < 2) {
        ReactNativeBiometrics.simplePrompt({ promptMessage: 'Confirm fingerprint' })
          .then((resultObject) => {
            const { success } = resultObject

            if (success) {
              console.log('successful biometrics provided')
            } else {
              this.setState({ modalVisible: true })
            }
          })
          .catch(() => {
            console.log('biometrics failed')
            this.setState({ passed: false });
          })
      }
      try {

        Location.getCurrentPositionAsync({ accuracy: 4 }).then(async (data) => {

          let distDiff = getDistance({ latitude: data.coords.latitude, longitude: data.coords.longitude, }, JSON.parse(await AsyncStorage.getItem('LatLng')));
          let uid = await AsyncStorage.getItem("uid");
          let dBdata = await firestore()
            .collection('UserInfo').doc(uid).get();
          if (dBdata._data.isHome) {
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
          }
        }
        )

      }
      catch (err) {

      }

    }

    this.setState({ appState: nextAppState });
  };
  render() {
    const { navigation, horizontal } = this.props;
    if (this.state.firstRun) {
      return (
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Step 1" component={PermissionScreen} />
            <Stack.Screen name="Step 2" component={this.AddressScreen} />
            <Stack.Screen name="Welcome" component={this.WelcomeScreen} />

          </Stack.Navigator>
        </NavigationContainer>
      );
    }
    else {
      return (

        <NavigationContainer>

          <Modal
            animationType="slide"
            transparent={false}
            visible={this.state.modalVisible}
          >
            <View style={styles.container}>
              <Button title={'Please Try Again'} onPress={() => {
                ReactNativeBiometrics.simplePrompt({ promptMessage: 'Confirm fingerprint' })
                  .then((resultObject) => {
                    const { success } = resultObject

                    if (success) {
                      console.log('successful biometrics provided')
                      this.setState({ modalVisible: false })
                    }
                  })
                  .catch(() => {
                    console.log('biometrics failed')
                  })

              }} />
            </View>
          </Modal>
          <MyTabs />
        </NavigationContainer>
      );
    }

  }


}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
