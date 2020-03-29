import React from 'react';
import { Modal, StyleSheet, Switch, Text, FlatList, Platform, TouchableOpacity, ScrollView, Dimensions, View, Button, Alert } from "react-native";
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import AsyncStorage from '@react-native-community/async-storage';
import firestore, { firebase } from '@react-native-firebase/firestore';

const width = Dimensions.get('screen').width;
const height = Dimensions.get('screen').height;
export default class Settings extends React.Component {
  constructor() {
    super();
  }
  state = {
    Addr: "",
    modalVisible: false,
    tempAddr: null,
    latlng: null,
  };
  async componentDidMount() {
    var myAddr = await AsyncStorage.getItem('FullAddr'); //get stored addr
    this.setState({ Addr: myAddr });
  }

  render() {
    return (
      <View>
        <View style={{
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
        }} >
          <Text style={{fontSize:18}}>Your Address:</Text>
          <View style={{borderColor:'#808080',borderRadius:2,borderWidth:1,padding:2}}>
            <Text style={{fontSize:20}}>{this.state.Addr}</Text>

            <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Button title="update" onPress={() => { this.setState({ modalVisible: true }) }} />

          </View>
          </View>
          <TouchableOpacity
            style={{flex: 1,
              justifyContent: 'flex-end',alignItems:'center'}}
           onPress={()=>{
             Alert.alert("Reset Application","Are you sure to reset?", [
              
              {text: 'Cancel', onPress: () => console.log('Cancel Pressed')},
              {text: 'OK', onPress: () => AsyncStorage.clear()},
            ])
           }}
     >
       <Text style={{color:'#ff3333',fontSize:25}}>DEBUG: Reset Application </Text>
     </TouchableOpacity>
          <Modal
            animationType="slide"
            transparent={true}
            visible={this.state.modalVisible}
            onRequestClose={() => { this.setState({ modalVisible: false }) }}
          >
            <View style={{ width: width * 0.9, height: height * 0.95, marginTop: height * 0.05, marginHorizontal: width * 0.05, borderRadius: 5, marginalignSelf: 'center', backgroundColor: 'grey' }}>
              <GooglePlacesAutocomplete
                placeholder={this.state.Addr}
                minLength={2} // minimum length of text to search
                autoFocus={false}
                returnKeyType={'search'} // Can be left out for default return key https://facebook.github.io/react-native/docs/textinput.html#returnkeytype
                keyboardAppearance={'light'} // Can be left out for default keyboardAppearance https://facebook.github.io/react-native/docs/textinput.html#keyboardappearance
                listViewDisplayed='false'    // true/false/undefined
                fetchDetails={true}
                renderDescription={row => row.description} // custom description render
                onPress={async (data, details = null) => { // 'details' is provided when fetchDetails = true
                  this.setState({ tempAddr: data.description, latlng: details.geometry.location })
                }}
                getDefaultValue={() => ''}
                query={{
                  // available options: https://developers.google.com/places/web-service/autocomplete
                  key: '***',
                  language: 'en' // default: 'geocode'
                }}
                styles={{

                  textInputContainer: {
                    backgroundColor: 'rgba(1.0,1.0,1.0)',
                    borderTopWidth: 0,
                    borderBottomWidth: 0
                  },
                  listView: {
                    backgroundColor: 'rgba(1.0,1.0,1.0)',

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
              <View style={{ marginBottom: height * 0.1, flexDirection: 'row-reverse', justifyContent: 'space-evenly' }}>
                <Button title="Update" onPress={async () => {
                  let passAddr = await this.state.tempAddr;
                  let passLatLng = await this.state.latlng;
                  AsyncStorage.setItem('FullAddr', passAddr);
                  AsyncStorage.setItem('LatLng', JSON.stringify(passLatLng));
                  let uid = await AsyncStorage.getItem('uid');
                  firestore()
                    .collection('UserInfo').doc(uid).update({
                      fullAddr: passAddr,
                      lat: passLatLng.lat,
                      lng: passLatLng.lng,
                      lastUpdate:new Date(),
                    });
                  this.setState({ Addr: passAddr, modalVisible: false });
                }} />
                <Button title="Cancel" onPress={() => { this.setState({ modalVisible: false }) }} />
              </View>
            </View>
          </Modal>

        </View>

      </View>
    );
  }
}

