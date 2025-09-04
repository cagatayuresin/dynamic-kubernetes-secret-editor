# 🔐 Dynamic Kubernetes Secret Editor

[![Live Demo](https://img.shields.io/badge/Demo-Live-blue?style=flat-square)](https://cagatayuresin.github.io/dynamic-kubernetes-secret-editor/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Issues](https://img.shields.io/github/issues/cagatayuresin/dynamic-kubernetes-secret-editor?style=flat-square)](https://github.com/cagatayuresin/dynamic-kubernetes-secret-editor/issues)
[![Stars](https://img.shields.io/github/stars/cagatayuresin/dynamic-kubernetes-secret-editor?style=flat-square)](https://github.com/cagatayuresin/dynamic-kubernetes-secret-editor/stargazers)

Dynamic Kubernetes Secret Editor is a web-based tool designed to simplify the management of Kubernetes secrets. It allows you to upload, decode, edit, and download Kubernetes secrets in YAML format with ease. This tool is perfect for developers and DevOps engineers who frequently work with Kubernetes secrets.

## 🚀 Live Demo

Check out the live demo here: [Dynamic Kubernetes Secret Editor](https://cagatayuresin.github.io/dynamic-kubernetes-secret-editor/)

---

## 📜 Features

- **Dual Input Methods** - Upload YAML files OR paste YAML content directly
- **Base64 Decoding** - Automatically decode Base64-encoded secret values for easy editing
- **Real-time YAML Preview** - View the updated YAML with syntax highlighting
- **Smart File Downloads** - Save modified secrets with intelligent naming (includes timestamp)
- **Modern UI/UX** - Beautiful gradient design with Tabler Icons
- **Theme Toggle** - Switch between light and dark modes with smooth transitions
- **Persistent State** - Automatically saves your work in localStorage for later use
- **Toast Notifications** - Beautiful notifications with progress bars and icons
- **Keyboard Shortcuts** - Ctrl+Enter to process, Ctrl+Shift+C to clear, Tab for indentation
- **Loading States** - Visual feedback during all operations
- **Data Management** - Clear stored data and export configuration
- **Enhanced Validation** - Comprehensive validation for Kubernetes Secret format
- **Security Focused** - All processing happens locally in the browser
- **Responsive Design** - Works seamlessly on desktop and mobile devices
- **Progressive Enhancement** - Fallback support for older browsers

---

## 🛠️ Technologies Used

- **Frontend**: HTML, CSS (Bulma, custom styles), JavaScript
- **Libraries**:
  - [js-yaml](https://github.com/nodeca/js-yaml) for YAML parsing and stringifying.
  - [Highlight.js](https://highlightjs.org/) for syntax highlighting.
  - [Font Awesome](https://fontawesome.com/) for icons.

---

## 📦 Installation

To run the project locally, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/cagatayuresin/dynamic-kubernetes-secret-editor.git
   ```
2. Navigate to the project directory:
   ```bash
   cd dynamic-kubernetes-secret-editor
   ```
3. Open `index.html` in your browser to use the tool.

---

## 🖥️ Usage

### Method 1: File Upload
1. **Upload a YAML File**: Click the "Upload YAML File" button and select a Kubernetes secret YAML file.

### Method 2: Paste Content
1. **Paste YAML Content**: Copy your Kubernetes secret YAML and paste it into the text area.
2. **Use Shortcuts**: 
   - `Ctrl+Enter` to process the YAML
   - `Ctrl+Shift+C` to clear the content
   - `Tab` for proper YAML indentation

### Common Steps
2. **Edit Decoded Fields**: Modify the decoded Base64 values directly in the input fields.
3. **Preview Changes**: View the updated YAML in the preview section with syntax highlighting.
4. **Download the Updated YAML**: Click the "Download" button to save the modified YAML file.

### Quick Test
Use the included `test-secret.yaml` file to quickly test the application features.

---

## 🛡️ License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). Feel free to use, modify, and distribute it as per the license terms.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for improvements or find any bugs, feel free to open an issue or submit a pull request.

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes:
   ```bash
   git commit -m "Add your feature description"
   ```
4. Push to the branch:
   ```bash
   git push origin feature/your-feature-name
   ```
5. Open a pull request.

---

## 🌐 Connect with Me

- **GitHub**: [cagatayuresin](https://github.com/cagatayuresin)
- **LinkedIn**: [Çağatay Üresin](https://www.linkedin.com/in/cagatayuresin/)

---

## 📢 Acknowledgements

- Thanks to the developers of [js-yaml](https://github.com/nodeca/js-yaml) and [Highlight.js](https://highlightjs.org/) for their amazing libraries.
- Inspired by the need for a simple and intuitive Kubernetes secret management tool.

---

## 📝 Notes

This project is hosted on GitHub Pages. To deploy updates, simply push changes to the `main` branch, and GitHub Pages will automatically update the live demo.

---

Enjoy using the **Dynamic Kubernetes Secret Editor**! 🎉
