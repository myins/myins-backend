import { Injectable } from '@nestjs/common';
import * as PushNotifications from 'node-pushnotifications';
if (process.env.NODE_ENV !== 'production') require('dotenv').config(); // This fixes env variables on dev
import { FirebaseMessagingService } from '@aginix/nestjs-firebase-admin';


const sandboxSettings = {
  gcm: {
    id: '',
  },
  apn: {
    token: {
      key: Buffer.from(process.env['APNS_AUTH_KEY'] ?? "", 'base64').toString(), // optionally: fs.readFileSync('./certs/key.p8')
      keyId: process.env['APNS_AUTH_KEY_ID'],
      teamId: process.env['APNS_AUTH_KEY_TEAM_ID'],
    },
    production: false, // true for APN production environment, false for APN sandbox environment,
  },
  isAlwaysUseFCM: false, // true all messages will be sent through node-gcm (which actually uses FCM)
};

const prodSettings = {
  gcm: {
    id: '',
  },
  apn: {
    token: {
      key: Buffer.from(process.env['APNS_AUTH_KEY'] ?? "", 'base64').toString(), // optionally: fs.readFileSync('./certs/key.p8')
      keyId: process.env['APNS_AUTH_KEY_ID'],
      teamId: process.env['APNS_AUTH_KEY_TEAM_ID'],
    },
    production: true,
  },
  isAlwaysUseFCM: false,
};

const sandboxPush = new PushNotifications(sandboxSettings);
const prodPush = new PushNotifications(prodSettings);

@Injectable()
export class NotificationPushService {
  constructor(private readonly messagingService: FirebaseMessagingService) { }

  async pushData(token: string, sandbox: boolean, data: PushNotifications.Data) {
    if (token.toLowerCase() !== token) {
      // Android token
      const x = data.custom

      let couldUnwrapAndSend = false
      if (x !== undefined) {
        if (typeof x !== 'string') {
          let copy: { [key: string]: string } = {}
          Object.keys(x).forEach(each => {
            copy[each] = JSON.stringify(x[each])
          })

          this.messagingService.sendToDevice(token, {
            notification: {
              title: data.title,
              body: data.body,
            },
            data: copy,
          })
          couldUnwrapAndSend = true
        }
      }

      if (!couldUnwrapAndSend) { // No data, send it without

        this.messagingService.sendToDevice(token, {
          notification: {
            title: data.title,
            body: data.body,
            target: token,
            author: ""
          },
        })
      }

    } else {
      
      if (sandbox) {
        return sandboxPush.send(token, data);
      } else {
        return prodPush.send(token, data)
      }
    }
  }
}
