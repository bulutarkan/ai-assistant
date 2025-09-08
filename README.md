# CK AI Assistant - Ceku 🤖

> Complete AI Chatbot System for CK Health Turkey - Built with Modern Technologies

![CK AI Assistant](https://img.shields.io/badge/CK--Health--Turkey-orange?style=for-the-badge&logo=ck)
![React](https://img.shields.io/badge/React-18.2-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.0-ff69b4?style=flat-square&logo=vite)
![Supabase](https://img.shields.io/badge/Supabase-2023-green?style=flat-square&logo=supabase)

## 🌟 Features

### 🤖 AI Assistant Features
- **Ceku AI Assistant** - CK Health Turkey'nin özel AI asistani
- **Google Gemini 2.5 Flash** - En güncel ve güçlü AI modeli entegrasyonu
- **Real-time Streaming** - Anlık yanıt akışı
- **Multi-language Support** - Çoklu dil desteği

### 📁 File Management
- **Drag & Drop Upload** - Modern sürükle bırak arayüzü
- **Multiple File Types** - Office documents, PDF, Images, Archives
- **File Preview** - Resimler için otomatik önizleme
- **Smart Validation** - Dosya boyutu ve tip kontrolü

### 🔗 Smart Link Detection
- **Auto-detection** - URL'leri otomatik algılama
- **Favicon Integration** - Site favicon'ları otomatik çekme
- **Link Preview** - Güral görünümde önizleme kartı
- **Fallback System** - Hata durumlarında domain adı gösterme

### 📊 Project Management
- **Supabase Integration** - Real-time veritabanı
- **Task Management** - Görev oluşturma ve takip
- **Auto-cleanup** - 7 gün sonra otomatik silme
- **Persistent Storage** - Tüm veriler saklanır

### 🎨 UI/UX
- **Dark Theme** - Modern koyu tema tasarımı
- **Responsive Design** - Mobil uyumlu
- **Smooth Animations** - Geçiş efektleri
- **Modern Components** - React/TypeScript ile geliştildi

### 💼 Business Features
- **Conversation History** - Tüm sohbet geçmişi
- **Projects Dashboard** - İş yönetimi sistemi
- **Reminder System** - Hatırlatıcı bildirimleri
- **Analytics Ready** - İstatistik ve raporlama desteği

## 🚀 Deployments

### Netlify Deployment
1. **Clone Repository:**
```bash
git clone https://github.com/bulutarkan/ck-ai-assistant.git
cd ck-ai-assistant
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Environment Setup:**
```bash
cp .env.example .env.local
# Fill in your API keys
```

4. **Development:**
```bash
npm run dev
```

5. **Production Build:**
```bash
npm run build
```

#### Netlify Build Settings
```json
{
  "build_command": "npm run build",
  "publish_directory": "dist",
  "environment_variables": {
    "GEMINI_API_KEY": "your_gemini_api_key_here",
    "VITE_SUPABASE_URL": "your_supabase_url_here",
    "VITE_SUPABASE_ANON_KEY": "your_supabase_key_here"
  }
}
```

## 🛠️ Technologies Used

- **Frontend:** React 18, TypeScript, Vite
- **Backend:** Supabase (Postgres + Real-time)
- **AI:** Google Gemini 2.5 Flash API
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React Hooks
- **Build Tool:** Vite
- **Deployment:** Netlify / Vercel / AWS Amplify

## 📁 Project Structure

```
ck-ai-assistant/
├── components/
│   ├── auth/           # Authentication components
│   ├── chat/           # Chat interface components
│   ├── files/          # File management
│   ├── projects/       # Project management
│   ├── settings/       # Settings modal
│   ├── ui/             # Reusable UI components
├── hooks/              # Custom React hooks
├── services/           # API services & integrations
├── types/              # TypeScript type definitions
├── assets/             # Static assets
├── .env.example        # Environment template
└── README.md
```

## 🔐 Environment Variables

Create a `.env.local` file in the root directory:

```env
# Gemini AI Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Optional: GitHub Integration
GITHUB_TOKEN=your_github_token_here
```

## 📦 Installation & Setup

1. **Clone the repository:**
```bash
git clone https://github.com/bulutarkan/ck-ai-assistant.git
cd ck-ai-assistant
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**
```bash
cp .env.example .env.local
```

4. **Start development server:**
```bash
npm run dev
```

5. **Visit `http://localhost:5173`**

## 🏗️ Build & Production

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 CI/CD Pipeline

### GitHub Actions
- **Automated Testing** - Unit tests ve integration tests
- **Build Optimization** - Bundle analiz ve optimization
- **Security Scans** - Vulnerability checking
- **Auto-deployment** - Main branch'e push sonrası otomatik

### Netlify Optimization
- **Edge Functions** - Serverless functions
- **Image Optimization** - Automatic image processing
- **Progressive Web App** - PWA desteği
- **CDN Caching** - Global content delivery

## 📊 API Documentation

### Gemini AI Service
- **Model:** `gemini-2.5-flash` / `gemini-2.0-flash` (fallback)
- **Features:** Text generation, Image analysis
- **Streaming:** Real-time response streaming

### Supabase Integration
- **Database:** PostgreSQL with real-time subscriptions
- **Authentication:** Supabase Auth integration
- **Tables:** conversations, projects, tasks, users

## 🔒 Security Features

- **API Key Protection** - Sensitive data .env'de saklanır
- **CORS Protection** - Domain-based access control
- **Input Validation** - File type validation
- **Rate Limiting** - API çağrı sınırlaması

## 🎯 Performance Optimization

- **Lazy Loading** - Bileşen yükleme optimizasyonu
- **Code Splitting** - Bundle parçalama
- **Asset Optimization** - Image compression
- **Caching Strategy** - Browser caching policies

## 📱 Mobile Support

- **Responsive Design** - All screen sizes supported
- **Touch Gestures** - Mobile-friendly interactions
- **PWA Ready** - Installable mobile app
- **Offline Support** - Basic offline functionality

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a Pull Request

## 📋 License

This project is proprietary software of CK Health Turkey.
All rights reserved. Unauthorized copying or distribution is prohibited.

## 📞 Contact

**CK Health Turkey AI Team**
- Email: ai@ckhealthturkey.com
- Website: https://ckhealthturkey.com
- GitHub: https://github.com/bulutarkan

## 🔄 Version History

### v1.0.0 (Current)
- ✅ Complete AI chatbot system
- ✅ Supabase database integration
- ✅ File upload capabilities
- ✅ Link preview system
- ✅ Project management
- ✅ Mobile responsive UI
- ✅ Production deployment ready

---

**Built with ❤️ by CK Health Turkey Team**
