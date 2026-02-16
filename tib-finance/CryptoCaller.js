/**
 * API TIB FINANCE SDK
 *
 * NOTE:
 * You must change the serverURL attribute value to the Production URL
 * if you want to use the SDK in PROD.
 *
 */

class CryptoCaller {
  static serverURL = "";
  static sessionId = "";
  static serviceId;
  static clientId;
  static userName;
  static password;

  static initialize(serverURL, serviceId, clientId, userName, password) {
    CryptoCaller.serverURL = serverURL;
    CryptoCaller.serviceId = serviceId;
    CryptoCaller.clientId = clientId;
    CryptoCaller.userName = userName;
    CryptoCaller.password = password;
  }

  static createSession() {
    CryptoCaller.sessionId = CryptoCaller.getCookie("sessionId");

    if (CryptoCaller.sessionId === null || CryptoCaller.sessionId == "") {
      var methodName = "/data/CreateSession";
      var loginInfo = {
        ClientId: CryptoCaller.clientId,
        Username: CryptoCaller.userName,
        Password: CryptoCaller.password,
      };

      return new Promise(function (resolve, reject) {
        CryptoCaller.performCall(methodName, loginInfo)
          .then(function (data) {
            if (data.HasError) {
              reject(data.Messages);
            } else {
              resolve(data);
              CryptoCaller.setCookie("sessionId", data.SessionId, 1);
              CryptoCaller.sessionId = data.SessionId;
              return CryptoCaller.sessionId;
            }
          })
          .catch(function (error) {
            reject(error.responseText);
          });
      });
    } else {
      return new Promise(function (resolve, reject) {
        resolve(CryptoCaller.sessionId);
      });
    }
  }

  /**
   * Get the TIB FINANCE server public key
   *
   * @returns
   */
  static getPublicKey() {
    return $.ajax({
      url: CryptoCaller.serverURL + "/data/GetPublicKey",
      method: "POST",
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  /**
   * Encrypt a key
   * @param {*} getPublicKeyResult
   * @returns
   */
  static cryptKeys(getPublicKeyResult) {
    var returnData,
      remotePublicRsaProvider,
      localPublicKeyXml,
      mergedPublicKeyAndSymetricKeyArray,
      encryptedLocalPublicKeyAndClientSymetricKeyXml;

    returnData = {
      serverPublicKey: getPublicKeyResult.PublicKeyXmlString, //Public key content
      callNode: getPublicKeyResult.NodeAnswered, //For call affinity
      publicKeyToken: getPublicKeyResult.KeyToken, //Public Key Token ID
      rsaProvider: new System.Security.Cryptography.RSACryptoServiceProvider(
        512
      ), //Create a local provider to create a new asymetric key pair to allow the server to crypte it's symetric key'
      symetricKeyClientPart: CryptoCaller.randomArray(16, 255), //Half of the symetric key (CLIENT).
    };

    //Create the rsa provider from the server side received key
    remotePublicRsaProvider =
      new System.Security.Cryptography.RSACryptoServiceProvider();
    remotePublicRsaProvider.FromXmlString(returnData.serverPublicKey);

    //Encrypt both key
    var localPublicKeyUtf8Array = System.Text.Encoding.UTF8.GetBytes(
      returnData.rsaProvider.ToXmlString(false)
    );
    mergedPublicKeyAndSymetricKeyArray =
      returnData.symetricKeyClientPart.concat(localPublicKeyUtf8Array);

    encryptedLocalPublicKeyAndClientSymetricKeyXml =
      remotePublicRsaProvider.Encrypt(
        mergedPublicKeyAndSymetricKeyArray,
        false
      );

    returnData.cryptedPublicKeyAndClientSymetricBase64 =
      System.Convert.ToBase64String(
        encryptedLocalPublicKeyAndClientSymetricKeyXml
      );

    return returnData;
  }

  /**
   * Exchange keys between the application and the TIB FINANCE server
   *
   * @param {*} data
   * @returns
   */
  static performKeyExchange(data) {
    //Prepare the crypted key data to be transmited to the server.
    //Must provide the node received for service affinity and the related key Token to allow the service to use the right private key.
    var keyExchangeData = {
      CallNode: data.callNode,
      KeyToken: data.publicKeyToken,
      AsymetricClientPublicKeyAndClientSymetricXmlBase64:
        data.cryptedPublicKeyAndClientSymetricBase64,
    };

    return new Promise(function (resolve, reject) {
      $.ajax({
        url: CryptoCaller.serverURL + "/data/ExecuteKeyExchange",
        method: "POST",
        data: JSON.stringify({ key: keyExchangeData }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (callResult, status, xhr) {
          resolve({
            callNode: data.callNode,
            keyToken: callResult.FullSymetricKeyToken,
            key: data.symetricKeyClientPart.concat(
              data.rsaProvider.Decrypt(
                System.Convert.FromBase64String(callResult.SymetricHostHalfKey)
              )
            ),
            iv: CryptoCaller.randomArray(16, 255),
          });
        },
        error: reject,
      });
    });
  }

  /**
   * Execute a call to the TIB FINANCE API
   *
   * @param {*} url - The method name to call on TIB FINANCE (e.g., '/Data/ListCustomers')
   * @param {*} cryptedData - The encrypted data to send to TIB FINANCE
   * @returns
   */
  static performTheCall(url, cryptedData) {
    var data = {
      CallNode: cryptedData.callNode,
      KeyToken: cryptedData.keyToken,
      Base64IV: cryptedData.ivBase64,
      Base64CryptedData: cryptedData.data,
    };

    return new Promise(function (resolve, reject) {
      $.ajax({
        url: CryptoCaller.serverURL + url,
        type: "POST",
        data: JSON.stringify({ data: data }),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data, textStatus, jqXHR) {
          resolve({
            cryptedData: data.CryptedBase64Data,
            iv: data.IV,
          });
        },
        error: reject,
      });
    });
  }

  //Tools
  static randomArray(length, max) {
    return Array.from(crypto.getRandomValues(new Uint8Array(length)));
  }

  /**
   * Encrypts data and executes a call to the TIB FINANCE API
   *
   * @param {*} url - The method name to call on TIB FINANCE (e.g., '/Data/ListCustomers')
   * @param {*} data - The plaintext data to encrypt and send to TIB FINANCE
   * @returns
   */
  static performCall(url, data) {
    return new Promise(function (resolve, reject) {
      let encryptionKey;
      CryptoCaller.getCryptedCallKeyData()
        .then(function (callEncryptionKey) {
          encryptionKey = callEncryptionKey.key;
          return CryptoCaller.cryptData(data, callEncryptionKey);
        })
        .then(function (cryptedData) {
          return CryptoCaller.performTheCall(url, cryptedData);
        })
        .then(function (cryptedCallResult) {
          return CryptoCaller.decryptCallData(cryptedCallResult, encryptionKey);
        })
        .then(function (decryptedData) {
          resolve(decryptedData);
        })
        .catch(function (error) {
          reject(error);
        });
    });
  }

  /**
   * Prepare the data by adding the sessionId and service Id
   * This method should be used after the session has been created
   *
   * @param {*} data
   * @param {*} serviceId
   * @param {*} session
   * @returns
   */
  static prepareData(data, serviceId, sessionId) {
    data.SessionToken = sessionId;
    data.ServiceId = serviceId;

    return data;
  }

  /**
   * Call the TIB FINANCE API
   * This method is the entry point to the SDK. It should be used by the project integrating the SDK
   *
   * @param {*} methodName
   * @param {*} data
   * @returns
   */
  static callTibFinance(methodName, data) {
    return new Promise(function (resolve, reject) {
      CryptoCaller.createSession(
        CryptoCaller.clientId,
        CryptoCaller.userName,
        CryptoCaller.password
      )
        .then(function (sessionId) {
          return CryptoCaller.prepareData(
            data,
            CryptoCaller.serviceId,
            CryptoCaller.sessionId
          );
        })
        .then(function (data) {
          return CryptoCaller.performCall(methodName, data);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Encrypt the symmetric key and perform key exchange
   *
   * @returns
   */
  static getCryptedCallKeyData() {
    return new Promise(function (resolve, reject) {
      CryptoCaller.getPublicKey()
        .then(CryptoCaller.cryptKeys) //Crypt the symetric key and the local PublicKey(that the server will use the crypt the return) using the server provided public key.
        .then(function (data) {
          return CryptoCaller.performKeyExchange(data);
        })
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Encrypt the data
   *
   * @param {*} data
   * @param {*} callEncryptionKey
   * @returns
   */
  static cryptData(data, callEncryptionKey) {
    var stringToCrypt, byteArrayToCrypt;

    stringToCrypt = JSON.stringify(data);
    byteArrayToCrypt = System.Text.Encoding.UTF8.GetBytes(stringToCrypt);

    return {
      callNode: callEncryptionKey.callNode,
      keyToken: callEncryptionKey.keyToken,
      ivBase64: System.Convert.ToBase64String(callEncryptionKey.iv),
      data: CryptoCaller.encryptRijdnael(
        callEncryptionKey.key,
        callEncryptionKey.iv,
        byteArrayToCrypt
      ),
    };
  }

  /**
   * Encryption method used to encrypt the data
   *
   * @param {*} key
   * @param {*} iv
   * @param {*} input
   * @returns
   */
  static encryptRijdnael(key, iv, input) {
    // Create an instance of the Rijndael class.
    var cipher = new System.Security.Cryptography.RijndaelManaged();
    // Get cryptor as System.Security.Cryptography.ICryptoTransform class.
    var cryptor = cipher.CreateEncryptor(key, iv);
    // Create new Input.
    return CryptoCaller.CipherStreamWriteToB64(cryptor, input);
  }

  static CipherStreamWriteToB64(cryptor, input) {
    var outputBuffer = CryptoCaller.CipherStreamWrite(cryptor, input);
    return System.Convert.ToBase64String(outputBuffer);
  }

  static CipherStreamWrite(cryptor, input) {
    var bufferLength = 0;

    if (input.length) {
      bufferLength = input.length;
    } else if (input.byteLength) {
      bufferLength = input.byteLength;
    }
    var inputBuffer = new System.Byte(bufferLength);
    // Copy data bytes to input buffer.
    System.Buffer.BlockCopy(input, 0, inputBuffer, 0, inputBuffer.length);
    // Create a MemoryStream to hold the output bytes.
    var stream = new System.IO.MemoryStream();
    // Create a CryptoStream through which we are going to be processing our data.
    var mode = System.Security.Cryptography.CryptoStreamMode.Write;
    var cryptoStream = new System.Security.Cryptography.CryptoStream(
      stream,
      cryptor,
      mode
    );
    // Start the crypting process.
    cryptoStream.Write(inputBuffer, 0, inputBuffer.length);
    // Finish crypting.
    cryptoStream.FlushFinalBlock();
    // Convert data from a memoryStream into a byte array.
    var outputBuffer = stream.ToArray();
    // Close both streams.
    stream.Close();
    cryptoStream.Close();
    return outputBuffer;
  }

  /**
   * Decrypt the data
   *
   * @param {*} cryptedCallResult
   * @param {*} encryptionKey
   * @returns
   */
  static decryptCallData(cryptedCallResult, encryptionKey) {
    var decryptedResponse;

    decryptedResponse = CryptoCaller.decryptRijdnael(
      encryptionKey,
      cryptedCallResult.iv,
      System.Convert.FromBase64String(cryptedCallResult.cryptedData)
    );

    return JSON.parse(decryptedResponse);
  }

  /**
   * Decryption method used to decrypt the data
   *
   * @param {*} key
   * @param {*} iv
   * @param {*} input
   * @returns
   */
  static decryptRijdnael(key, iv, input) {
    // Create an instance of the Rijndael class.
    var cipher = new System.Security.Cryptography.RijndaelManaged();
    // Get cryptor as System.Security.Cryptography.ICryptoTransform class.
    var cryptor = cipher.CreateDecryptor(key, iv);
    // Create new Input.
    return CryptoCaller.CipherStreamRead(cryptor, input);
  }

  static CipherStreamRead(cryptor, input) {
    var outputBuffer = CryptoCaller.CipherStreamReadBytes(cryptor, input);
    return System.Text.Encoding.UTF8.GetString(outputBuffer);
  }

  static CipherStreamReadBytes(cryptor, input) {
    var bufferLength = 0;

    if (input.length) {
      bufferLength = input.length;
    } else if (input.byteLength) {
      bufferLength = input.byteLength;
    }
    var inputBuffer = new System.Byte(bufferLength);
    // Copy data bytes to input buffer.
    System.Buffer.BlockCopy(input, 0, inputBuffer, 0, bufferLength);
    // Create a MemoryStream to hold the output bytes.
    var stream = new System.IO.MemoryStream();

    // Create a CryptoStream through which we are going to be processing our data.
    var mode = System.Security.Cryptography.CryptoStreamMode.Write;
    var cryptoStream = new System.Security.Cryptography.CryptoStream(
      stream,
      cryptor,
      mode
    );
    // Start the crypting process.
    cryptoStream.Write(inputBuffer, 0, bufferLength);
    // Finish crypting.
    cryptoStream.FlushFinalBlock();
    // Convert data from a memoryStream into a byte array.
    var outputBuffer = stream.ToArray();
    // Close both streams.
    stream.Close();
    cryptoStream.Close();

    return outputBuffer;
  }

  static getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(";");
    for (var i = 0; i < ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  static setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      var time = days * 24 * 60 * 60 * 1000;
      date.setTime(date.getTime() + time);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
}
