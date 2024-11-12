import {
    Alert, 
    ToastAndroid,
} from 'react-native';
import {
    GoogleSignin,
    statusCodes,
} from 'react-native-google-signin';
import config from '../../config';
import Env from './env';


export default class GoogleService {

    URL = 'https://www.googleapis.com/drive/v3';
    UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3';
    BOUNDARY = 'MONEYMAN';

    constructor(){

        GoogleSignin.configure({
            scopes: config.scopes,
            webClientId: config.webClientId,
            offlineAccess: true,
        });

    }

    obj() {
        return GoogleSignin;
    }

    // onSuccess(userInfo, fileId, backupData);
    async signIn(onSuccess){
        try{
            // Check if device has Google Play Services installed
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // signin
            const userInfo = await GoogleSignin.signIn();
            Env.writeStorage(Env.key.USER_INFO, userInfo);


            // check existing backup
            ToastAndroid.show('Checking backup data..', ToastAndroid.LONG);
            const token = await GoogleSignin.getTokens();
            const options = this._configureGetOptions(token.accessToken);
            let response = await fetch(`${this.URL}/files?spaces=appDataFolder&fields=files/id`, options);
            let responseJson = await response.json();   // WARN: required new var before extract the values

            let files = responseJson.files;
            
            // backup not found
            if (files.length === 0) {

                // init default categories
                Env.initDefaultCategories();

                onSuccess(userInfo, null, null);
                return;
            }

            // backup founded, getting the file
            const fileId = files[0].id;
            response = await fetch(`${this.URL}/files/${fileId}?alt=media`, options);
            const backupData = await response.json();

            onSuccess(userInfo, fileId, backupData);

        }
        catch(error){
            this._handleError(error);
        }
    }


    async signOut(onSuccess){
        try {
            await GoogleSignin.revokeAccess();
            await GoogleSignin.signOut();

            onSuccess();
        } 
        catch (error) {
            this._handleError(error);
        }
    }

    // uploads a file with its contents and its meta data (name, description, type, location)
    async upload(content, onSuccess) {

        // get new access-token with signInSilently()
        await GoogleSignin.signInSilently();
        const token = await GoogleSignin.getTokens();
        const accessToken = token.accessToken;
        
        const fileId = Env.readStorage(Env.key.BACKUP_FILE_ID);

        const body = this._createMultipartBody(content, !!fileId);
        const options = this._configurePostOptions(accessToken, body.length, !!fileId);
        let response = await fetch(`${this.UPLOAD_URL}/files${fileId ? `/${fileId}` : ''}?uploadType=multipart`, {
            ...options,
            body
        });
        let responseJson = await response.json();

        // TODO: handle unexpected response

        Env.writeStorage(Env.key.BACKUP_FILE_ID, responseJson.id);

        onSuccess();
    }

    async deleteBackup(){

        // check existing backup
        const token = await GoogleSignin.getTokens();
        const options = this._configureGetOptions(token.accessToken);
        let response = await fetch(`${this.URL}/files?spaces=appDataFolder&fields=files/id`, options);
        let responseJson = await response.json(); 

        let files = responseJson.files;

        // backup file not exist
        if (files.length === 0) {
            return;
        }

        for(let i=0; i<files.length; i++){
            let fileId = files[i].id;

            const options = this._configureDeleteOptions(token.accessToken);
            response = await fetch(`${this.URL}/files/${fileId}`, options);
        };

    }


   
    _createMultipartBody(body, isUpdate=false) {

        // google-drive-api multipart-upload defines the structure
        const metadata = {
            name: 'backup_moneyman.json',
            description: 'Backup data for my app',
            mimeType: 'application/json',
        }

        // if it already exists, specifying parents again throws an error
        if (!isUpdate) metadata.parents = ['appDataFolder']

        // request body
        const multipartBody = `\r\n--${this.BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${this.BOUNDARY}\r\nContent-Type: application/json\r\n\r\n` +
            `${JSON.stringify(body)}\r\n` +
            `--${this.BOUNDARY}--`;

        return multipartBody;
    }

    _configureDeleteOptions(accessToken) {

        const headers = new Headers();
        headers.append('Authorization', `Bearer ${accessToken}`);
        return {
            method: 'DELETE',
            headers,
        }
    }

    _configureGetOptions(accessToken) {

        const headers = new Headers();
        headers.append('Authorization', `Bearer ${accessToken}`);
        return {
            method: 'GET',
            headers,
        }
    }

    _configurePostOptions(accessToken, bodyLength, isUpdate=false) {

        const headers = new Headers();
        headers.append('Authorization', `Bearer ${accessToken}`);
        headers.append('Content-Type', `multipart/related; boundary=${this.BOUNDARY}`);
        headers.append('Content-Length', bodyLength);

        return {
            method: isUpdate ? 'PATCH' : 'POST',
            headers,
        }
    }



    _handleError(error){
        if(error.code === '401'){
            ToastAndroid.show('Invalid credentials', ToastAndroid.SHORT);
        }
        else if(error.code === '404'){
            ToastAndroid.show('Backup not found', ToastAndroid.SHORT);
        }
        else if (error.code === statusCodes.SIGN_IN_CANCELLED) {
            // sign in was cancelled
            ToastAndroid.show('Cancelled', ToastAndroid.SHORT);
        } 
        else if (error.code === statusCodes.IN_PROGRESS) {
            // operation in progress already
            ToastAndroid.show('On progress', ToastAndroid.SHORT);
        } 
        else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            ToastAndroid.show('Play services not available or outdated', ToastAndroid.SHORT);
        } 
        else if(error.code === '7'){
            // no connection
            ToastAndroid.show('Connection required', ToastAndroid.SHORT);
        }
        else {
            Alert.alert('Something went wrong', error.toString());
            ToastAndroid.show('Something went wrong', ToastAndroid.SHORT);
        }
    }


}