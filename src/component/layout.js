import React, { Component } from 'react';
import '../App.css';
import { Image, Table, Button, Input, Form } from 'semantic-ui-react';
import MoiBit from '../moibit_logo_transparent.png';
import TableList from './tableList';
import credentials from '../middleware/credentials';
import Instance from '../middleware/web3';
import axios from 'axios';
import ShowModal from './modal';
const EthCrypto = require('eth-crypto');


class Layout extends Component {
    state = {
        fileList: [],
        file: '',
        accountId: '',
        loading: false,
        fieldReq: false,
        readFileIframe: '',
        fileType: '',
        modalOpen: false,
        fileName: '',
        fileBase64: '',
        temp_public_key: 'bf6b78a26b7abc11f9e59da81e2fade5be67de7af914df64119598d70536862b87bc1344db520d902fc0468f8b262b7e14b1a1fef38a5a9a45c6ae4f4c8a993e',
        temp_private_key: '0xc90624630837b22cd1dde951bf441c7f4636a4e1b7d5918f3764b14b82d17456'
    }
    async componentDidMount() {

        let acc = await Instance.web3.eth.getAccounts();
        this.setState({ accountId: acc[0] });
        this.observe();
        axios.defaults.headers.common['api_key'] = credentials.API_KEY;
        axios.defaults.headers.common['api_secret'] = credentials.API_SECRET;

        if (acc[0] === credentials.ADMIN) {
            this.getALLHashes();
        }
        else {
            this.getFileHash();
        }
    }

    getFileHash = async () => {
        let data = await Instance.Config.methods.getList().call({ from: this.state.accountId });
        let actual = [];
        if (data.length !== 0) {
            for (let i = 0; i < data.length; i++) {
                actual.push({
                    Name: data[i].fileName.split("/")[1],
                    Hash: data[i].fileHash,
                    verfiledBoolean: 0
                });
            }
        }
        this.setState({ fileList: actual });
    }

    getALLHashes = async () => {
        let response = await axios({
            method: 'post',
            url: credentials.CUSTOM_URL + "/moibit/v0/listfiles",
            data: { path: "/" }
        });

        let data = [];
        if (response.data.data.Entries !== null) {
            for (let i = 0; i < response.data.data.Entries.length; i++) {
                if (response.data.data.Entries[i].Type === 0) {
                    await data.push({
                        Name: response.data.data.Entries[i].Name,
                        Hash: response.data.data.Entries[i].Hash,
                        verfiledBoolean: 0
                    });
                }
            }
        }
        this.setState({ fileList: data });
    }
    handleSubmit = async (e) => {
        e.preventDefault();
        if (this.state.file !== "") {
            let formData = new FormData();
            formData.append('file', this.state.file);
            formData.append('fileName', '/' + this.state.file.name);
            this.setState({ loading: true });

            let response = await axios({
                method: 'post',
                url: credentials.CUSTOM_URL + "/moibit/v0/writefile",
                data: formData
            });
            const actualFileName = credentials.API_KEY + "" + response.data.data.Path + "" + response.data.data.Name;
            await Instance.Config.methods.setHash(actualFileName, response.data.data.Hash).send({ from: this.state.accountId });
            if (this.state.accountId === credentials.ADMIN) {
                this.getALLHashes();
                this.setState({ loading: false });
            }
            else {
                this.getFileHash();
                this.setState({ loading: false });
            }
            this.setState({ loading: false });
        }
        else {
            this.setState({ fieldReq: true })
        }
    }

    observe = async () => {
        try {
            setTimeout(this.observe, 1000);
            const accounts = await Instance.web3.eth.getAccounts();
            if (accounts[0] === this.state.accountId) {

            }
            else {
                window.location = "/";
            }
            return;
        }
        catch (error) {
            console.log(error.message);
        }
    }

    checkForProvenence = async (name, hash) => {
        let response = await axios({
            method: 'post',
            url: credentials.CUSTOM_URL + "/moibit/v0/listfiles",
            data: { path: "/" }
        });

        let allFiles = response.data.data.Entries;
        const index1 = allFiles.map(e => e.Name).indexOf(name);
        let checkingHash = '';
        if (index1 !== -1) {
            checkingHash = allFiles[index1].Hash;
        }


        let successs = true;
        let files = this.state.fileList;
        const index = files.map(e => e.Name).indexOf(name);
        if (files[index].verfiledBoolean === 0) {
            files[index] = {
                Name: name,
                Hash: hash,
                verfiledBoolean: 2
            }
            this.setState({ fileList: files });

            /* we are rendering all the root files so we are adding / in prefix to file name */
            const filename = credentials.API_KEY + '/' + name;
            if (checkingHash === await Instance.Config.methods.getHashByName(filename).call()) {
                files[index] = {
                    Name: name,
                    Hash: hash,
                    verfiledBoolean: 1
                }
                this.setState({ fileList: files });
            }
            else {
                files[index] = {
                    Name: name,
                    Hash: hash,
                    verfiledBoolean: -1
                }
                this.setState({ fileList: files });
                successs = false;
            }
            return successs;
        }
        else {
            return successs;
        }
    }

    readFile = async (filehash, fileName) => {
        if (await this.checkForProvenence(fileName, filehash)) {
            var responseType = '';
            if (fileName.substr(-3, 3) === "txt" || fileName.substr(-3, 3) === "csv" || fileName.substr(-3, 3) === "php" || fileName.substr(-3, 3) === "html" || fileName.substr(-2, 2) === "js") {
                responseType = '';
            }
            else {
                responseType = 'blob';
            }
            const url = credentials.CUSTOM_URL + '/moibit/v0/readfilebyhash';
            axios({
                method: 'post',
                url: url,
                responseType: responseType,
                data: {
                    hash: filehash
                }
            })
                .then(response => {
                    if (typeof (response.data) == "string") {
                        this.setState({
                            readFileIframe: response.data,
                            fileType: response.headers['content-type'],
                            fileName: fileName,
                            modalOpen: true
                        });
                    }
                    else {
                        this.setState({
                            readFileIframe: window.URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] })),
                            fileType: response.headers['content-type'],
                            fileName: fileName,
                            modalOpen: true
                        })
                    }
                })
                .catch(error => {
                    console.log(error);
                });
        }
        else {
            this.setState({
                readFileIframe: "The file got modified off-chain",
                fileType: 'text/plain',
                fileName: 'Alert!',
                modalOpen: true
            });
        }
    }
    modalClose = () => {
        this.setState({ modalOpen: false });
    }

    async encrypt(_publicKey, _message) {
        return await EthCrypto.encryptWithPublicKey(_publicKey, _message);
    };

    async decrypt(_privateKey, _encrypted) {
        return await EthCrypto.decryptWithPrivateKey(_privateKey, _encrypted);
    }

    async runEncrypt(_publicKey, _message) {
        var encrypted = await this.encrypt(_publicKey, _message);
        return encrypted
    }

    async runDecrypt(_privateKey, _encrypted) {
        var decrypted = await this.decrypt(_privateKey, _encrypted);
        return decrypted;
    }
    convertBase64toBlob(content, contentType) {
        contentType = contentType || '';
        var sliceSize = 512;
        var byteCharacters = window.atob(content); //method which converts base64 to binary
        var byteArrays = [
        ];
        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            var slice = byteCharacters.slice(offset, offset + sliceSize);
            var byteNumbers = new Array(slice.length);
            for (var i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            var byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        var blob = new Blob(byteArrays, {
            type: contentType
        }); //statement which creates the blob
        return blob;
    }
    downloadBlob(_blob, type) {
        let blobData = this.convertBase64toBlob(_blob, type)
        let url = window.URL.createObjectURL(blobData)
        var a = document.createElement('a')
        document.body.appendChild(a);
        a.style = "display:none"
        a.href = url
        a.download = "downloadedFile"
        a.click()
        document.body.removeChild(a)
        document.location.reload();
    }

    render() {
        const custom_header = {
            backgroundColor: '#222222',
            color: '#fbfbfb',
            border: '1px solid #fbfbfb'
        }
        return (
            <div className="layoutBG">
                {this.state.fileName !== '' ? <ShowModal modalOpen={this.state.modalOpen}
                    modalClose={this.modalClose}
                    fileType={this.state.fileType}
                    responseData={this.state.readFileIframe}
                    fileName={this.state.fileName}
                /> : null}
                <div style={{ display: 'flex', color: '#fbfbfb', marginLeft: '42vw' }}>
                    <Image src={MoiBit} height="60px" width="160px" />
                    {/* <h3 style={{ marginTop: '10px', fontSize: '26px' }}>MoiBit</h3> */}
                </div>
                <div className="table_body_scrollable">
                    {/* HIDE FROM HERE IF NOT AUTHENTICATED */}
                    <Form onSubmit={(event) => this.handleSubmit(event)} encType="multipart/form-data">
                        <Table celled size="small" style={{ marginTop: '20px', marginBottom: '40px', background: '#f2f2f2', color: '#222222' }}>
                            {/* IF NOT ADMIN HIDE */}
                            <Table.Header>
                                <Table.Row>

                                    <Table.HeaderCell style={custom_header}>
                                        <Table.Row>
                                            <Table.Cell textAlign="center" colSpan='2'>
                                                <Input type="file" onChange={(e) => {
                                                    const _file = e.target.files[0];
                                                    const type = _file.type
                                                    this.setState({ file: _file });
                                                    // BASE64 ENCODING
                                                    var reader = new FileReader();
                                                    reader.onload = (theFile => {
                                                        return e => {
                                                            var binaryData = e.target.result;
                                                            var base64String = window.btoa(binaryData); // encoded to base64
                                                            // console.log(base64String)

                                                            this.setState({ fileBase64: base64String });
                                                            this.runEncrypt(
                                                                this.state.temp_public_key,
                                                                this.state.fileBase64
                                                            ).then(encoded => {
                                                                console.log(encoded);
                                                                this.runDecrypt(
                                                                    this.state.temp_private_key,
                                                                    encoded
                                                                ).then((e) => {
                                                                    console.log(this.convertBase64toBlob(e, type))
                                                                    this.downloadBlob(e, type)

                                                                })
                                                            })

                                                        }
                                                    })(_file)
                                                    reader.readAsBinaryString(_file);

                                                }} required name="file" style={this.state.fieldReq ? { border: '2px solid red', borderRadius: '5px' } : {}} />
                                            </Table.Cell>
                                        </Table.Row>
                                        <Table.Row>
                                            <Table.Cell colSpan='2' textAlign="center" >
                                                <Button primary type="submit" loading={this.state.loading} disabled={this.state.loading} >Submit</Button>
                                            </Table.Cell>
                                        </Table.Row>
                                    </Table.HeaderCell>

                                    <Table.HeaderCell style={custom_header}>
                                        <Table.Row>
                                            <Table.Cell colSpan='2'>
                                                API_KEY : {credentials.API_KEY}
                                            </Table.Cell>
                                        </Table.Row>
                                        <Table.Row>
                                            <Table.Cell colSpan='2'>
                                                <div style={{ wordWrap: 'break-word', width: '600px' }}>
                                                    API_SECRET : {credentials.API_SECRET}
                                                </div>
                                            </Table.Cell>
                                        </Table.Row>
                                    </Table.HeaderCell>
                                </Table.Row>
                                {/* TILL HERE */}
                            </Table.Header>
                        </Table>
                    </Form>
                    <div className="content-container">
                        <TableList fileList={this.state.fileList} readFile={this.readFile}
                        />
                    </div>
                    {/* TO HERE */}


                </div>
            </div>
        );
    }
}
export default Layout;