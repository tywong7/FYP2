import React from 'react';
import {  Text,Dimensions,View } from "react-native";
const width = Dimensions.get('screen').width;
const height = Dimensions.get('screen').height;

export default class About extends React.Component{
  


  constructor() {
    super();
    state = {
 
    };
  
  }
  
  componentDidMount() {

  }

  

  render() {


    return (
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
       <Text>About</Text>

      </View>

    );
  }
}

