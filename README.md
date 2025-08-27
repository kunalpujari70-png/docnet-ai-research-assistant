# DocNet AI Research Assistant

A powerful, full-stack AI research assistant that combines document analysis with web search capabilities to provide comprehensive research insights.

## 🌟 Features

- **Multi-AI Provider Support**: OpenAI GPT-4 and Google Gemini integration
- **Document Analysis**: Upload and analyze PDFs, DOCs, and text files
- **Web Search Integration**: Combine document insights with current web information
- **Smart Context**: AI intelligently uses uploaded documents and web data
- **Chat History**: Persistent chat sessions with export/import functionality
- **Modern UI**: Sleek, responsive design with dark theme and glassmorphism effects
- **Real-time Processing**: Instant document analysis and AI responses

## 🚀 Live Demo

**Production URL**: https://karmic-aiportal.netlify.app

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router 6** for SPA routing
- **TailwindCSS 3** for styling
- **Custom Components** with glassmorphism design

### Backend
- **Express.js** server
- **Netlify Functions** for serverless deployment
- **OpenAI API** integration
- **Google Gemini API** integration
- **DuckDuckGo** for web search

### Data Management
- **Supabase** for user authentication and file metadata
- **Local Storage** for chat sessions and settings
- **File Processing** with PDF text extraction

## 📁 Project Structure

```
├── client/                   # React SPA frontend
│   ├── pages/               # Route components
│   ├── components/          # Reusable UI components
│   ├── contexts/            # React contexts (Auth, Theme)
│   ├── services/            # API service layer
│   └── global.css           # Global styles
├── server/                  # Express API backend
│   ├── routes/              # API route handlers
│   └── index.ts             # Server configuration
├── netlify/                 # Netlify deployment
│   └── functions/           # Serverless functions
├── shared/                  # Shared types and utilities
└── dist/                    # Build output
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- OpenAI API key
- Google Gemini API key (optional)
- Supabase account (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/docnet-ai-research-assistant.git
   cd docnet-ai-research-assistant
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start development server**
   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:8080`

### Development Commands

```bash
pnpm dev              # Start development server (frontend + backend)
pnpm dev:server       # Start backend server only
pnpm build            # Build for production
pnpm build:netlify    # Build for Netlify deployment
pnpm deploy           # Deploy to Netlify
pnpm test             # Run tests
pnpm typecheck        # TypeScript validation
```

## 🔧 Configuration

### AI Providers
- **OpenAI**: Set `OPENAI_API_KEY` in environment variables
- **Gemini**: Set `GEMINI_API_KEY` in environment variables
- **Default**: Configure in Settings page

### Document Processing
- Supported formats: PDF, DOC, DOCX, TXT
- Automatic text extraction and summarization
- Relevance scoring for AI context

### Web Search
- DuckDuckGo integration for real-time information
- Configurable search preferences
- Combines with document analysis

## 🎨 UI Features

- **Dark Theme**: Modern dark interface with glassmorphism effects
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Sidebar Navigation**: Collapsible chat history and file management
- **Settings Panel**: Comprehensive configuration options
- **File Upload**: Drag-and-drop interface with progress indicators

## 🔒 Security

- API keys stored securely in environment variables
- User authentication via Supabase
- Guest mode available for testing
- Secure file handling and processing

## 📊 Performance

- **Fast Loading**: Optimized bundle with Vite
- **Efficient Processing**: Streamlined document analysis
- **Caching**: Intelligent caching of chat sessions and settings
- **CDN**: Global content delivery via Netlify

## 🚀 Deployment

### Netlify (Recommended)
1. Connect your GitHub repository to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy automatically on push to main branch

### Manual Deployment
```bash
pnpm build:netlify
netlify deploy --prod --dir=dist/spa --functions=netlify/functions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Google for Gemini API
- Supabase for backend services
- Netlify for hosting and serverless functions
- Vite for fast build tooling
- React team for the amazing framework

## 📞 Support

For support, email support@docnet.ai or create an issue in this repository.

---

**Made with ❤️ for researchers and knowledge workers**
