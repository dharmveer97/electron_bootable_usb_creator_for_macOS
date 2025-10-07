# Bootable USB Creator for macOS

A modern Electron desktop application to create bootable Windows USB drives on macOS with an intuitive interface.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🎨 **Modern UI** - Clean interface built with Tailwind CSS
- 💾 **Windows ISO Support** - Create bootable Windows installation media
- 🔧 **Flexible Partitioning** - Support for both MBR and GPT partition schemes
- 📁 **Multiple File Systems** - FAT32, exFAT, and NTFS support
- 🚀 **Two-Step Process** - Separate format and bootable creation steps
- 📥 **Smart ISO Detection** - Auto-detect ISO files in your Downloads folder
- 🔄 **Live USB Detection** - Automatically detect and list connected USB drives
- 📊 **Progress Tracking** - Real-time progress updates during operations
- 🛡️ **Safe Operation** - Multiple confirmation prompts to prevent data loss

## 📋 Requirements

- **macOS** 10.12 Sierra or later
- **Administrator privileges** - Required for disk operations
- **USB drive** - 8GB or larger recommended for Windows installations
- **Windows ISO file** - Downloaded from official Microsoft sources
- **Node.js** - Version 14 or later
- **Electron** - Version 28 or later (installed via npm)

## 🚀 Installation

### Quick Start

1. **Clone or download this repository**
   ```bash
   cd /path/to/bootable-usb-creator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Launch the application**
   ```bash
   npm start
   ```

### Development Setup

```bash
# Install dependencies
npm install

# Start in development mode
npm start

# (Optional) Install electron-packager for building
npm install --save-dev electron-packager
```

## 📖 Usage Guide

### Step-by-Step Process

1. **Select ISO File**
   - Click **"Browse Files"** to manually select a Windows ISO
   - Or click **"Use Downloads Folder"** to auto-detect ISOs in your Downloads

2. **Detect USB Drive**
   - Insert your USB drive
   - Click **"Refresh Devices"** to scan for USB drives
   - Select your target USB drive from the dropdown

3. **Configure Settings**
   - **Partition Scheme:**
     - **GPT** - For modern UEFI systems (recommended for Windows 10/11)
     - **MBR** - For legacy BIOS systems
   - **File System:**
     - **FAT32** - Maximum compatibility (recommended)
     - **exFAT** - For larger files
     - **NTFS** - Windows native format

4. **Format USB (Step 1)**
   - Click **"1. Format USB"**
   - Enter your macOS administrator password when prompted
   - Wait for formatting to complete (1-2 minutes)

5. **Make Bootable (Step 2)**
   - Click **"2. Make Bootable"**
   - Wait for files to copy (5-10 minutes)
   - Do not disconnect the USB during this process

6. **Completion**
   - Once complete, safely eject the USB drive
   - Your bootable USB is ready to use!

### Recommended Settings

| Target System | Partition Scheme | File System |
|--------------|------------------|-------------|
| Windows 10/11 UEFI | GPT | FAT32 |
| Windows 7 Legacy BIOS | MBR | FAT32 |
| Dell/HP Modern Laptops | GPT | FAT32 |

## ⚠️ Important Warnings

- **DATA LOSS:** This application will **PERMANENTLY ERASE ALL DATA** on the selected USB drive
- **Backup First:** Always backup important data before proceeding
- **Correct Drive:** Double-check you've selected the correct USB drive
- **Don't Disconnect:** Never disconnect the USB during formatting or file copying
- **Administrator Access:** You will be prompted for your password for disk operations

## 🛠️ Building Standalone App

Create a distributable macOS application:

```bash
# Install packager
npm install --save-dev electron-packager

# Build for macOS
npx electron-packager . BootableUSBCreator \
  --platform=darwin \
  --arch=x64 \
  --icon=icon.icns \
  --overwrite

# The app will be created in: BootableUSBCreator-darwin-x64/
```

Then move the generated `.app` to your Applications folder.

## 📁 Project Structure

```
bootable-usb-creator/
├── main.js           # Electron main process
├── app.js            # Application logic and USB operations
├── index.html        # UI and layout
├── package.json      # Project dependencies
├── .gitignore        # Git ignore rules
└── README.md         # This file
```

## 🔧 Technical Details

### Technologies Used
- **Electron** - Cross-platform desktop framework
- **Node.js** - JavaScript runtime
- **Tailwind CSS** - Utility-first CSS framework
- **macOS diskutil** - Disk management utility
- **rsync** - File copying utility

### Key Operations
- USB detection via `diskutil list`
- Disk formatting via `diskutil eraseDisk`
- ISO mounting via `hdiutil mount`
- File copying via `rsync`

## 🐛 Troubleshooting

### No USB drives detected
- Ensure the USB drive is properly inserted
- Try a different USB port
- Click "Refresh Devices" after inserting the drive
- Check if the USB is mounted in Finder

### Format fails
- Ensure you entered the correct password
- Check if the USB drive is write-protected
- Try ejecting and reinserting the USB
- Verify you have administrator privileges

### File copy fails
- Ensure USB has enough space (8GB+ recommended)
- Check that ISO file is not corrupted
- Verify stable USB connection
- Try reformatting the USB drive

### Boot fails on target computer
- Verify the partition scheme matches the system (GPT for UEFI, MBR for BIOS)
- Check BIOS/UEFI settings for boot order
- Ensure Secure Boot is disabled if needed
- Try recreating the USB with different settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. Use at your own risk. The authors are not responsible for any data loss or damage to hardware.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI styled with [Tailwind CSS](https://tailwindcss.com/)
- Inspired by tools like Rufus and BalenaEtcher

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

---

**Made with ❤️ for the macOS community**
# electron_bootable_usb_creator_for_macOS
