# Browser call notifications

The backend sends incoming-call notifications using Web Push. Configure the VAPID keys as backend environment variables; keep the private key secret and do not commit it:

```powershell
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

Set the generated `publicKey` and `privateKey` values as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Keep the same key pair across restarts and deployments so existing device subscriptions remain valid. Optionally set `VAPID_SUBJECT` to a `mailto:` contact address. The frontend and backend must both be deployed over HTTPS (except localhost during development).

Each admin must sign in on each device, open **Profile → Call notifications**, and allow notifications. While the app is closed, the device must be online and its browser must permit background push. Tapping the notification opens BookLab; the admin still needs to answer in the app before microphone or camera access can start.
