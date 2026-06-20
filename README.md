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

## Components & Features

Music Dashboard includes a comprehensive collection of pre-built components and features for building music analytics platforms:

### Dashboard Components

* **Ecommerce Metrics** - Track sales, revenue, and performance indicators
* **Charts** - Line and bar charts for data visualization using ApexCharts
* **Sales Analytics** - Monthly sales trends and performance tracking
* **Recent Orders** - Display recent music-related transactions or activities
* **Demographic Analytics** - Geographic distribution and user demographics
* **Calendar** - Event scheduling and date management

### UI Components

* **Alerts** - Notification and alert elements
* **Avatars** - User profile images and avatars
* **Badges** - Status indicators and labels
* **Buttons** - Various button styles and states
* **Dropdowns** - Menu and selection components
* **Modals** - Dialog boxes for user interactions
* **Tables** - Data tables with pagination
* **Videos** - Video player and display components
* **Form Elements** - Input fields, select dropdowns, date pickers, switches

### Additional Features

* **Authentication Pages** - Sign in and sign up forms with responsive design
* **User Profile Management** - Profile cards and user information display
* **Responsive Sidebar Navigation** - Collapsible navigation with smooth transitions
* **Dark Mode** - Full dark mode support throughout the application
* **Drag & Drop** - Built-in drag-and-drop functionality using React DnD
* **Date Picker** - Calendar-based date selection using Flatpickr
* **Icons** - Comprehensive icon set via React Icons

## Tech Stack

Music Dashboard leverages modern, battle-tested technologies:

* **Frontend Framework**: Next.js 16.x with App Router for optimal performance
* **UI Library**: React 19 with advanced hooks and patterns
* **Styling**: Tailwind CSS v4 with dark mode support
* **Data Visualization**: ApexCharts for interactive charts
* **Calendar**: FullCalendar for event management
* **Drag & Drop**: React DnD with HTML5 backend
* **File Upload**: React Dropzone for file handling
* **Date Picker**: Flatpickr for date selection
* **Icons**: React Icons and custom icon library
* **Carousel**: Swiper for responsive image galleries

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
│   ├── app/              # Next.js app directory with routes
│   ├── components/       # Reusable React components
│   ├── context/          # Context providers (Theme, Sidebar)
│   ├── hooks/            # Custom React hooks
│   ├── icons/            # SVG and icon components
│   └── layout/           # Layout components (Header, Sidebar)
├── public/               # Static assets and images
├── tailwind.config.js    # Tailwind CSS configuration
├── next.config.mjs       # Next.js configuration
└── package.json          # Project dependencies
```

## Changelog

### Version 2.3.0 (Latest)

* Built on Next.js 16.1.6 with React 19
* Complete music dashboard implementation
* Tailwind CSS v4 with custom styling
* Enhanced dark mode support
* Responsive design for all screen sizes
* Music-focused branding and assets

### Version 2.2.3

* Updated ESLint configuration
* Upgraded Next.js to version 16.1.6

### Version 2.0.0

* Major update: Next.js 16 with App Router
* Redesigned UI with React Server Components
* Upgraded to React 19
* Tailwind CSS v4 implementation
* Enhanced data visualization with ApexCharts

For detailed update information, refer to the git commit history.

## Contributing

We welcome contributions! To contribute to Music Dashboard:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Music Dashboard is released under the MIT License. See the [LICENSE](LICENSE) file for details.

## Support

If you find this project helpful, please consider:

* Giving it a star on GitHub ⭐
* Reporting issues or suggesting features
* Contributing improvements
* Using it in your music projects

For questions or support, please open an issue on the GitHub repository.

---

**Built with ❤️ for music creators and professionals**
