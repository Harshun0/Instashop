# InstaShop

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a .env file in the root directory with your environment variables:
```env
MONGO_URI=your_mongodb_uri
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
SECRET=your_auth0_secret
BASEURL=http://localhost:5000
CLIENTID=your_auth0_client_id
ISSUER=your_auth0_issuer
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on http://localhost:5000 