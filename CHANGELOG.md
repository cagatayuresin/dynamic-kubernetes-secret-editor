# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-09-04

### Major Release - Complete UI/UX Overhaul

### Added
- **YAML Paste Area** - Users can now paste YAML content directly instead of uploading files
- **Modern Notification System** - Beautiful toast notifications with gradients and icons
- **Enhanced File Upload** - Redesigned upload button with gradient styling and animations
- **Keyboard Shortcuts** - Ctrl+Enter to process, Ctrl+Shift+C to clear, Tab for YAML indentation
- **Loading States** - Visual feedback during file processing, downloads, and exports
- **Smart Notifications** - Icons and emojis for better visual feedback
- **Progress Bars** - Auto-dismiss notifications with progress indicators
- **Custom Confirmation Dialogs** - Modern confirmation dialogs instead of browser alerts
- **Auto-resize Textarea** - YAML paste area automatically adjusts to content
- **Version Information** - Version display in footer with changelog link
- **Enhanced Error Handling** - Better error messages and validation
- **Dark Mode Improvements** - Better contrast and styling for dark theme

### Improved
- **Typography** - Added Orbitron font for main title, Inter for body text
- **Main Title** - Now in ALL CAPS with gradient colors and tech styling
- **Icon System** - Migrated from Font Awesome to Tabler Icons for modern look
- **Button Styling** - Gradient backgrounds and hover animations
- **Floating Buttons** - Enhanced design with gradients and better responsiveness
- **Footer Design** - Added social media icons with hover effects
- **Color Scheme** - More vibrant gradients and better contrast
- **Responsive Design** - Better mobile experience

### Technical Improvements
- **Unified YAML Processing** - Single function handles both file upload and paste
- **Better State Management** - Improved localStorage handling
- **Enhanced Validation** - More comprehensive Kubernetes Secret validation
- **Code Organization** - Better separation of concerns
- **Performance** - Optimized animations and transitions
- **Accessibility** - Better keyboard navigation and screen reader support

### Fixed
- **Icon Loading Issues** - Stable CDN for Tabler Icons
- **Theme Switching** - Improved dark/light mode transitions
- **Notification Positioning** - Better responsive positioning
- **File Download** - Enhanced filename generation with timestamps
- **Memory Management** - Better cleanup of object URLs

---

## [1.0.0] - 2024-XX-XX

### Initial Release
- Basic YAML file upload functionality
- Base64 decode/encode for Kubernetes secrets
- Real-time YAML preview with syntax highlighting
- Dark/light theme toggle
- Download modified secrets
- Persistent state with localStorage
- Basic validation for Kubernetes Secret format

---

## Development Guidelines

### Version Numbering
- **Major (X.0.0)** - Breaking changes or major feature additions
- **Minor (X.Y.0)** - New features, backward compatible
- **Patch (X.Y.Z)** - Bug fixes, backward compatible

### Change Categories
- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` for vulnerability fixes
