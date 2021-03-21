import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Provider as PaperProvider, Card, Appbar, List, Text, Button, Portal, FAB, Dialog, TextInput } from 'react-native-paper';
import * as Location from 'expo-location';
import * as SQLite from 'expo-sqlite';
import { Camera } from 'expo-camera';

const db = SQLite.openDatabase("sijainnit.db");

db.transaction(
    (tx) => {
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sijainnit (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      tunniste TEXT, ohje TEXT, lat NUMBER, lon NUMBER, pvm TEXT, aika TEXT
                    )`);
    }, 
    (err) => {
      console.log(err);
    });

db.transaction(
  (tx) => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS kuvat (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sijaintiid INTEGER,
                    kuva TEXT
                  )`);
  }, 
  (err) => {
    console.log(err);
  });

export default function App() {

  const [sijainnit, setSijainnit] = useState([]);
  const [uusiOhje, setUusiOhje] = useState();
  const [uusiTunniste, setUusiTunniste] = useState();
  const [sijaintiId, setSijaintiId] = useState();
  const [uusiSijaintiDialogi, setUusiSijaintiDialogi] = useState({ 
                                                            nayta : false });

  const [kuvaustila, setKuvaustila] = useState(false);
  const [kameraRef, setKameraRef] = useState(null);
  const [kuva, setKuva] = useState(null);
  const [kuvat, setKuvat] = useState([]);

  const dimensions = Dimensions.get('window');
  const screenWidth = dimensions.width;
  const height = Math.round((screenWidth * 16) / 9);

  const lisaaSijainti = async () => {

    let {status} = await Location.requestPermissionsAsync();

    if (status !== "granted") {
      alert("Sijainti ei saatavilla");
    }

    setUusiSijaintiDialogi({ nayta : false });

    let location = await Location.getCurrentPositionAsync({});
    let pvm = new Date(location.timestamp);
    let dd = pvm.getDate();
    let mm = pvm.getMonth()+1;
    let yyyy= pvm.getFullYear();
    pvm = dd + "." + mm + "." + yyyy;
    let aika = new Date(location.timestamp).toLocaleTimeString("fi-FI").slice(0,5);
    console.log(pvm)


    db.transaction(
      (tx) => {
        tx.executeSql(`INSERT INTO sijainnit (tunniste, ohje, lat, lon, pvm, aika) VALUES (?, ?, ?, ?, ?, ?)`, [uusiTunniste, uusiOhje, location.coords.latitude, location.coords.longitude, pvm, aika], 
          (_tx, rs) => {
            haeSijainnit();
          }
        )
      }, 
      (err) => {
        console.log(err)
      }); 

  }

  const haeSijainnit = () => {

    db.transaction(
        (tx) => {
          tx.executeSql(`SELECT * FROM sijainnit`, [], 
            (_tx, rs) => {
              setSijainnit(rs.rows._array);
            }
          )
        }, 
        (err) => {
          console.log(err)
        });    

  }

  const avaaKamera = async (id) => {

    let {status} = await Camera.requestPermissionsAsync();
    setSijaintiId(id);

    if (status === "granted") {
      setKuvaustila(true);
    } else {
      alert("Kamera ei saatavilla");
    }

  }

  const otaKuva = async () => {

    if (kameraRef) {
      const apukuva = await kameraRef.takePictureAsync();
      setKuva(apukuva.uri);
      setKuvaustila(false)
    }

    if(kuva){
      lisaaKuva()
    }

  }

  const lisaaKuva = () => {

    console.log("lisaakuva" + kuva)
    setKuva(null);

    db.transaction(
      (tx) => {
        tx.executeSql(`INSERT INTO kuvat (id, sijaintiid, kuva) VALUES (NULL, ?, ?)`, [sijaintiId, kuva],
          (_tx, rs) => {
            haeKuvat();
          }
        )
      }, 
      (err) => {
        console.log(err)
    }); 

  }

  const haeKuvat = () => {

    db.transaction(
        (tx) => {
          tx.executeSql(`SELECT * FROM kuvat`, [], 
            (_tx, rs) => {
              setKuvat(rs.rows._array);
            }
          )
        }, 
        (err) => {
          console.log(err)
        });    

  }

  const Kamera = () => {
    return (
      <Camera
        ratio="16:9"
        style={{
          height: height,
          width: "100%",
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center'
        }} ref={ (r) => { setKameraRef(r)} }
      >
        <FAB
          style={styles.nappiOtaKuva}
          icon="camera"
          onPress={() => otaKuva()}
        />
        <FAB
          style={styles.nappiSulje}
          icon="close"
          onPress={() => setKuvaustila(false)}
        />  
      </Camera>
    );
  };

  useEffect(() => {
    haeSijainnit(), haeKuvat();
  }, [], []);

  return (

    (kuvaustila)
    ? Kamera()
    : (kuva)
    ? lisaaKuva()
    : <PaperProvider>
        <Appbar.Header>
          <Appbar.Content title="Sijaintimuistio"/>
        </Appbar.Header>
        <ScrollView style={{ padding : 20 }}>
        
          {(sijainnit.length > 0)
          ? sijainnit.map((sijainti) => {
              return (
              <List.Section key={sijainti.id}>
                <List.Item title={sijainti.tunniste} description={sijainti.ohje} right={() => <List.Icon icon="map-marker" />}/>
                <List.Item title={`${sijainti.pvm} klo ${sijainti.aika}`} description="Aika"/>
                <List.Item title={`LAT ${sijainti.lat},  LON ${sijainti.lon}`} description="Koordinaatit"/>
                {(kuvat.length > 0)
                ? kuvat.map((kuva) => {
                  if(kuva.sijaintiid === sijainti.id){
                    return (
                      <Card key={(kuva.id)} style={styles.card}>
                        <Card.Cover source={{ uri: kuva.kuva }} style={{
                        width: screenWidth*0.4,
                        height: height*0.4,
                        }}/>
                      </Card>
                    )}})
                : null }
                <Button icon="camera" style={{marginTop:"2%"}} mode="outlined" onPress={() => { avaaKamera(sijainti.id) }}/>
              </List.Section>
              )
            })

          : <Text>Ei sijainteja</Text>
          }

          <Button 
            icon="plus"
            style={{marginTop : 20, marginBottom : 60}}
            mode="contained" 
            onPress={() => { setUusiSijaintiDialogi({ nayta: true }) }}>
              Lisää uusi
          </Button>    

          <Portal>
            <Dialog visible={uusiSijaintiDialogi.nayta} onDismiss={() => { setUusiSijaintiDialogi({ nayta : false })}}>
              <Dialog.Title>Uusi sijainti</Dialog.Title>
              <Dialog.Content>
                <TextInput
                  label="Tunniste"
                  mode="outlined"
                  placeholder="Kirjoita sijainnin tunniste"
                  onChangeText={ (teksti) => { setUusiTunniste( teksti ) } }
                />
                <TextInput
                  label="Ohje"
                  mode="outlined"
                  placeholder="Kirjoita ohjeteksti"
                  onChangeText={ (teksti) => { setUusiOhje( teksti ) } }
                />
              </Dialog.Content>
              <Dialog.Actions>
                <Button onPress={lisaaSijainti}>Lisää sijainti</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

        </ScrollView>

      </PaperProvider>
  );
}

const styles = StyleSheet.create({
  nappiSulje: {
    position: 'absolute',
    backgroundColor: '#2959FA',
    margin: 20,
    bottom: 0,
    right: 0
  },
  nappiOtaKuva: {
    position: 'absolute',
    backgroundColor: '#2959FA',
    margin: 20,
    bottom: 0,
    left: 0
  },
  card : {
    flex: 1,
    width: "100%",
    height: "100%",
    padding:"3%",
    alignItems: "center",
    elevation: 0
  },
});