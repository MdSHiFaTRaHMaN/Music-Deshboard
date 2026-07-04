# Music Dashboard - Next.js Admin Dashboard for Music Analytics

Music Dashboard is a modern, feature-rich music analytics and management platform built on **Next.js 16 and Tailwind CSS**. It provides musicians, producers, and music managers with comprehensive tools to track performance metrics, visualize data, manage playlists, and monitor music-related activities.

Built with the latest web technologies, Music Dashboard offers a professional interface for music industry professionals to make data-driven decisions.

## Overview

Music Dashboard is a specialized admin dashboard designed for the music industry, providing essential features and components for building music analytics and management platforms. It's built on:

* Next.js 16.x with App Router
* React 19
* Tailwind CSS v4
* ApexCharts for advanced data visualization
* FullCalendar for event management
* Responsive design with dark mode support

### Key Features

* 📊 Music analytics and metrics tracking
* 🎵 Playlist and track management
* 📈 Interactive charts and visualizations
* 🎭 Professional dashboard layouts
* 🌙 Dark mode support
* 📱 Fully responsive design
* ⚡ Built with modern React and Next.js patterns

## Installation

### Prerequisites

Before getting started, ensure you have the following installed:

* Node.js 18.x or later (Node.js 20.x or later recommended)
* npm or yarn package manager

### Setup Instructions

1. Navigate to the project directory:
   ```bash
   cd Music-Dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
   > Use the `--legacy-peer-deps` flag if you encounter peer-dependency conflicts.

3. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser to access the dashboard.

### Building for Production

To create a production build:

```bash
npm run build
npm start
# or
yarn build
yarn start
```

## Features Overview

Music Dashboard is specifically tailored to automate the creation and delivery of custom AI-generated music based on customer orders.

### Core App Features
* **AI Music Generation:** Seamlessly integrates with the Suno API to generate custom songs based on customer inputs (genre, occasion, recipient).
* **Shopify Integration:** Automatically captures new orders via Shopify webhooks and syncs order details to the dashboard.
* **Automated Order Fulfillment:** Once a song finishes generating, the system automatically marks the Shopify order as fulfilled via the Shopify Admin API.
* **Klaviyo Email Automation:** Triggers custom Klaviyo events (`Music_Delivered`) to automatically email customers their finished songs and download links.
* **Admin Control Panel:** A complete UI for admins to view pending orders, track AI generation status, manually fulfill orders, and configure API credentials.

### UI & Dashboard Components
* **Analytics & Metrics:** Track sales, revenue, and performance indicators using ApexCharts.
* **Order Management:** Real-time data tables showing order status, generated tracks, and customer details.
* **Settings Panel:** Secure configuration page to update MongoDB, Shopify, Klaviyo, and Suno API keys.
* **Authentication:** Secure JWT-based admin login.
* **Responsive & Dark Mode:** Fully responsive UI with dark mode support built on Tailwind CSS v4.

## Server Structure & Architecture

The application is built on **Next.js 16 (App Router)** and utilizes its powerful API routes to act as a full-stack application.

### Backend Architecture
* **API Routes (`src/app/api/`)**:
  * `/api/shopify/webhooks/...`: Listens for Shopify order creation events to ingest new orders.
  * `/api/music/generate`: Communicates with the Suno AI API to initiate song generation tasks.
  * `/api/music/check-status`: Background polling endpoint to check if pending songs have finished generating.
  * `/api/klaviyo/trigger`: Formats data and dispatches custom events to Klaviyo for email delivery.
  * `/api/shopify/fulfill`: Interacts with the Shopify Admin API to mark orders as complete and update fulfillment locations.
* **Database (`src/models/`)**: 
  * Uses **MongoDB** (via Mongoose) to store `Orders` (tracking generation status and Shopify IDs) and `Settings` (storing API keys securely).
* **Utility Libraries (`src/lib/`)**: 
  * Reusable modules for Shopify fulfillment (`shopifyFulfill.js`), Klaviyo API calls (`klaviyo.js`), and MongoDB connection management.

## Deployment Process

The application is designed to be easily deployed on **Vercel** or any standard Node.js hosting environment (like Render, Heroku, or an EC2 instance).

### 1. Environment Variables
Before deploying, ensure you configure the following environment variables in your hosting provider:
```env
MONGODB_URI="mongodb+srv://<username>:<password>@cluster.mongodb.net/YourDB"
JWT_SECRET="your_super_secret_jwt_key"
```
*(Note: Other API keys like Shopify, Klaviyo, and Suno are managed dynamically via the Admin Dashboard's Settings page and stored in MongoDB).*

### 2. Deploying to Vercel (Recommended)
1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/) and create a new project.
3. Import your GitHub repository.
4. Add the `MONGODB_URI` and `JWT_SECRET` in the Environment Variables section.
5. Click **Deploy**.

### 3. Deploying to a Node.js Server (VPS/EC2)
1. Clone the repository on your server.
2. Run `npm install` to install dependencies.
3. Create a `.env.local` file in the root directory and add your environment variables.
4. Build the application: `npm run build`
5. Start the production server: `npm start`
*(It is recommended to use a process manager like **PM2** to keep the app running in the background).*

### 4. Post-Deployment Setup
1. Log in to the Admin Dashboard using your credentials.
2. Navigate to the **Settings** page.
3. Enter your **Shopify Admin API Key**, **Shopify Store URL**, **Klaviyo API Key**, and **Suno API Key**.
4. Set up your Shopify Webhook to point to `https://your-domain.com/api/shopify/webhooks/orders-create` for the `orders/create` topic.

## Development

### Running ESLint
To check code quality:
```bash
npm run lint
```

### Project Structure
```
Music-Dashboard/
├── src/
│   ├── app/              # Next.js App Router (Pages & API routes)
│   ├── components/       # Reusable React components (UI, Tables, Forms)
│   ├── lib/              # Utility functions and API wrappers
│   ├── models/           # Mongoose Database Schemas
│   └── icons/            # SVG and icon components
├── public/               # Static assets and images
├── tailwind.config.js    # Tailwind CSS configuration
└── next.config.mjs       # Next.js configuration
```

## License

Music Dashboard is released under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for music creators and professionals**
