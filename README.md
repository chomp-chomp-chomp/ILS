# Library Catalog System (ILS)

A modern, full-featured Integrated Library System (ILS) built with SvelteKit, PostgreSQL, and Supabase. Perfect for small to medium-sized libraries, personal collections, or library schools.

## ✨ Features

### 📚 Cataloging
- **MARC21 Format Support**: Create and manage bibliographic records in standard MARC21 format
- **ISBN Lookup**: Automatically import records from OpenLibrary API
- **Manual Entry**: Full MARC record creation with all major fields
- **Material Types**: Support for books, e-books, serials, DVDs, audiobooks, and more

### 🔍 Public OPAC (Online Public Access Catalog)
- **Simple Search**: Fast, user-friendly search across all fields
- **Advanced Search**: Boolean operators (AND/OR), field-specific searching, date ranges
- **Full-Text Search**: PostgreSQL-powered search with ranking and relevance
- **Detailed Records**: Display MARC data in user-friendly format
- **Holdings Information**: View availability, location, and copy information

### 📰 Serials Management
- **Serial Registration**: Track journals, magazines, and newsletters
- **Multiple Formats**: Support for print, electronic, and email newsletters
- **Frequency Patterns**: Daily, weekly, monthly, quarterly, annual, irregular
- **Subscription Tracking**: Start/end dates, active status
- **URL Linking**: Direct links to electronic serials

### 🔒 Admin Panel
- **Secure Authentication**: Supabase-powered user authentication
- **Dashboard**: Overview of catalog statistics
- **Cataloging Tools**: Create, edit, and manage MARC records
- **Holdings Management**: Track copies, locations, and availability
- **Serials Management**: Register and manage serial publications

## 🚀 Quick Start

### Deploy to Vercel + Supabase (FREE)

**Total Time: ~15 minutes | Cost: $0**

1. Follow the detailed **[DEPLOYMENT.md](./DEPLOYMENT.md)** guide
2. Create Supabase account and database (5 min)
3. Deploy to Vercel (3 min)
4. Set environment variables (2 min)
5. Create admin user (2 min)
6. Start cataloging!

### Local Development

```bash
# Clone repository
git clone https://github.com/YOUR-USERNAME/ILS.git
cd ILS

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Set up database (see DATABASE_SCHEMA.md)

# Start development server
npm run dev
```

## 📖 Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Database setup
- **[.env.example](./.env.example)** - Environment variables

## 🏗️ Tech Stack

- **SvelteKit** - Web framework
- **PostgreSQL** - Database (via Supabase)
- **Supabase** - Backend and authentication
- **Vercel** - Hosting
- **OpenLibrary API** - Bibliographic data

## 📊 Project Status

**Version**: 0.1.0-beta
**Status**: Active Development

**Ready for**: Personal libraries, small collections, educational use
**Not ready for**: Large institutional libraries, production without testing

## 🤝 Contributing

Contributions welcome! Report bugs or request features via GitHub Issues.

## 📄 License

MIT License

---

Made with ❤️ for librarians. **Happy Cataloging! 📚**
