# TrashBid

A platform for listing and bidding on recyclable materials.

## Features

- List recyclable materials for bidding
- Upload product images
- Real-time bidding system
- Track bidding history
- Secure user authentication
- Mobile-responsive design

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Multer for file uploads
- HTML/CSS/JavaScript frontend

## Installation

1. Clone the repository:
```bash
git clone [your-repo-url]
```

2. Install dependencies:
```bash
npm install
```

3. Create an uploads directory:
```bash
mkdir uploads
```

4. Set up environment variables:
Create a .env file with:
```
MONGODB_URI=your_mongodb_connection_string
PORT=5000
```

5. Start the server:
```bash
npm start
```

For development:
```bash
npm run dev
```

## API Endpoints

- `POST /api/products` - Create new product listing
- `GET /api/products` - Get all products
- `POST /api/products/:id/bid` - Place a bid
- `GET /api/stats` - Get platform statistics
- `DELETE /api/products/:id` - Delete a product

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[ISC](https://choosealicense.com/licenses/isc/) 