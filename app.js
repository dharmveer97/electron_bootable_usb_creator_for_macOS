let selectedISO = null;

// File input change handler
document.getElementById('isoFile').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        selectedISO = e.target.files[0].path;
        document.getElementById('selectedFile').textContent = `Selected: ${e.target.files[0].name}`;
        document.getElementById('selectedFile').classList.add('text-green-600', 'font-semibold');
    }
});

// Select Windows ISO from Downloads folder
function selectDownloadsISO() {
    const { execSync } = require('child_process');
    try {
        // Find ISO files in Downloads
        const downloadsPath = require('path').join(require('os').homedir(), 'Downloads');
        const isoFiles = execSync(`find "${downloadsPath}" -maxdepth 1 -name "*.iso" -o -name "*.ISO"`, {encoding: 'utf8'})
            .trim()
            .split('\n')
            .filter(f => f);

        if (isoFiles.length === 0) {
            alert('No ISO files found in Downloads folder');
            return;
        }

        // If multiple, show selection dialog
        if (isoFiles.length === 1) {
            selectedISO = isoFiles[0];
            const fileName = require('path').basename(selectedISO);
            document.getElementById('selectedFile').textContent = `Selected: ${fileName}`;
            document.getElementById('selectedFile').classList.add('text-green-600', 'font-semibold');
        } else {
            // Show list to user
            const fileList = isoFiles.map((f, i) => `${i + 1}. ${require('path').basename(f)}`).join('\n');
            const choice = prompt(`Multiple ISO files found:\n\n${fileList}\n\nEnter number (1-${isoFiles.length}):`);
            const index = parseInt(choice) - 1;

            if (index >= 0 && index < isoFiles.length) {
                selectedISO = isoFiles[index];
                const fileName = require('path').basename(selectedISO);
                document.getElementById('selectedFile').textContent = `Selected: ${fileName}`;
                document.getElementById('selectedFile').classList.add('text-green-600', 'font-semibold');
            }
        }
    } catch (error) {
        alert('Error finding ISO files: ' + error.message);
    }
}

// Refresh and list USB devices
function refreshUSBDevices() {
    const { execSync } = require('child_process');
    const select = document.getElementById('usbDrive');

    try {
        // List all disks using diskutil
        const output = execSync('diskutil list', {encoding: 'utf8'});

        // Parse ALL disks first
        const lines = output.split('\n');
        const disks = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Match disk lines: /dev/disk0, /dev/disk1, etc.
            const diskMatch = line.match(/^\/dev\/(disk\d+)\s+\(([^)]+)\)/);

            if (diskMatch) {
                const diskId = diskMatch[1];
                const diskType = diskMatch[2]; // e.g., "internal, physical" or "external, physical"

                try {
                    const info = execSync(`diskutil info /dev/${diskId}`, {encoding: 'utf8'});

                    // Check if it's removable/external
                    const isRemovable = info.includes('Removable Media: Removable') ||
                                       info.includes('Removable Media: Yes') ||
                                       info.includes('Removable Media:      Yes') ||
                                       info.includes('Removable Media:           Removable');

                    const isExternal = diskType.includes('external') ||
                                      info.includes('Device Location:           External') ||
                                      info.includes('Device Location: External');

                    const isUSB = info.includes('Protocol:                  USB') ||
                                 info.includes('Protocol: USB');

                    const isInternal = diskType.includes('internal');

                    const isVirtual = diskType.includes('virtual') ||
                                     diskType.includes('synthesized') ||
                                     info.includes('Virtual:                   Yes');

                    // Only add if it's USB/removable/external AND not internal AND not virtual
                    if ((isRemovable || isExternal || isUSB) && !isInternal && !isVirtual) {
                        // Try to get volume name from first partition
                        let volumeName = '';
                        try {
                            const volInfo = execSync(`diskutil info /dev/${diskId}s1`, {encoding: 'utf8'});
                            const volNameMatch = volInfo.match(/Volume Name:\s+(.+)/);
                            if (volNameMatch && !volNameMatch[1].includes('Not applicable')) {
                                volumeName = volNameMatch[1].trim();
                            }
                        } catch (e) {
                            // No volume name available
                        }

                        const nameMatch = info.match(/Device \/ Media Name:\s+(.+)/);
                        const sizeMatch = info.match(/Disk Size:\s+(.+)/);
                        const protocolMatch = info.match(/Protocol:\s+(.+)/);

                        const displayName = volumeName ||
                                          (nameMatch ? nameMatch[1].trim() : '') ||
                                          diskId;

                        disks.push({
                            device: `/dev/${diskId}`,
                            name: displayName,
                            size: sizeMatch ? sizeMatch[1].trim().split('(')[0].trim() : 'Unknown',
                            protocol: protocolMatch ? protocolMatch[1].trim() : '',
                            type: diskType
                        });
                    }
                } catch (e) {
                    // Skip if can't get info
                }
            }
        }

        // Update dropdown
        select.innerHTML = '<option value="">Select a USB drive...</option>';
        disks.forEach(disk => {
            const option = document.createElement('option');
            option.value = disk.device;
            option.textContent = `${disk.device} - ${disk.name} (${disk.size})`;
            select.appendChild(option);
        });

        if (disks.length === 0) {
            alert('No USB drives detected.\n\nPlease:\n1. Insert a USB drive\n2. Wait a few seconds\n3. Click "Refresh Devices" again');
        } else {
            alert(`Found ${disks.length} USB drive(s)`);
        }
    } catch (error) {
        alert('Error detecting USB drives: ' + error.message);
    }
}

// Format USB only
async function formatUSB() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const usbDrive = document.getElementById('usbDrive').value;
    if (!usbDrive) {
        alert('Please select a USB drive');
        return;
    }

    const partition = document.querySelector('input[name="partition"]:checked').value;
    const filesystem = document.querySelector('input[name="filesystem"]:checked').value;

    const confirmed = confirm(`⚠️ WARNING ⚠️\n\nThis will ERASE ALL DATA on ${usbDrive}\n\nAre you sure you want to format?`);
    if (!confirmed) return;

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
        // Get password
        progressText.textContent = 'Requesting administrator password...';
        progressBar.style.width = '10%';

        let sudoPassword;
        try {
            const passwordPrompt = await execAsync(
                `osascript -e 'Tell application "System Events" to display dialog "Enter your Mac password to format USB:" default answer "" with hidden answer with title "Administrator Access Required"' -e 'text returned of result'`
            );
            sudoPassword = passwordPrompt.stdout.trim();
        } catch (e) {
            throw new Error('Password entry cancelled');
        }

        // Unmount
        progressText.textContent = 'Unmounting disk...';
        progressBar.style.width = '30%';
        await execAsync(`diskutil unmountDisk ${usbDrive}`);

        // Format
        progressText.textContent = `Formatting as ${filesystem.toUpperCase()}...`;
        progressBar.style.width = '60%';

        const partitionScheme = partition === 'gpt' ? 'GPT' : 'MBR';
        const fsFormat = filesystem === 'fat32' ? 'MS-DOS FAT32' :
                        filesystem === 'exfat' ? 'ExFAT' : 'MS-DOS';

        await execAsync(`echo "${sudoPassword}" | sudo -S diskutil eraseDisk "${fsFormat}" WINDOWS ${partitionScheme} ${usbDrive}`, {
            timeout: 60000
        });

        progressBar.style.width = '100%';
        progressText.textContent = '✅ Format complete!';

        setTimeout(() => {
            const formatSuccessMessage = `
╔═══════════════════════════════════════╗
║      ✅ USB FORMATTED SUCCESSFULLY!      ║
╚═══════════════════════════════════════╝

Format Details:
📦 File System: ${filesystem.toUpperCase()}
🔧 Partition: ${partition.toUpperCase()}
💾 Volume Name: WINDOWS

📋 Next Step:
Click "2. Make Bootable" button to copy Windows files to USB

✅ Format completed successfully!
            `.trim();

            alert(formatSuccessMessage);
            progressContainer.classList.add('hidden');

            // Update progress text
            progressText.textContent = '✅ Format done! Click "Make Bootable" next.';
            progressText.classList.add('text-green-600', 'font-bold');
        }, 1500);

    } catch (error) {
        progressContainer.classList.add('hidden');
        alert('Error formatting USB:\n\n' + error.message);
        console.error(error);
    }
}

// Make bootable (copy files only, check format first)
async function makeBootable() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Validate selections
    if (!selectedISO) {
        alert('Please select an ISO file first');
        return;
    }

    const usbDrive = document.getElementById('usbDrive').value;
    if (!usbDrive) {
        alert('Please select a USB drive');
        return;
    }

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
        // Find the main data partition (not EFI partition)
        progressText.textContent = 'Finding USB partition...';
        progressBar.style.width = '5%';

        const diskList = await execAsync(`diskutil list ${usbDrive}`);
        let dataPartition = `${usbDrive}s1`;

        // Look for the main data partition (usually s2 for GPT, s1 for MBR)
        if (diskList.stdout.includes('Microsoft Basic Data') || diskList.stdout.includes('Windows_FAT_32')) {
            // GPT format - data partition is usually s2
            const lines = diskList.stdout.split('\n');
            for (const line of lines) {
                if (line.includes('Microsoft Basic Data') || line.includes('Windows_FAT_32') ||
                    (line.includes('Apple_HFS') && line.includes('WINDOWS'))) {
                    const match = line.match(/(disk\d+s\d+)/);
                    if (match) {
                        dataPartition = `/dev/${match[1]}`;
                        break;
                    }
                }
            }
        }

        // Check format of data partition
        progressText.textContent = 'Checking USB format...';
        progressBar.style.width = '10%';

        const diskInfo = await execAsync(`diskutil info ${dataPartition}`);
        const isFAT32 = diskInfo.stdout.includes('MS-DOS FAT32');
        const driveInfo = await execAsync(`diskutil info ${usbDrive}`);
        const isGPT = driveInfo.stdout.includes('GUID_partition_scheme');

        if (!isFAT32 || !isGPT) {
            const reformat = confirm('⚠️ USB is not formatted correctly!\n\nRecommended: GPT + FAT32\n\nDo you want to format it now?');
            if (reformat) {
                progressContainer.classList.add('hidden');
                await formatUSB();
                return;
            } else {
                throw new Error('USB must be formatted as GPT + FAT32 for Dell laptops');
            }
        }

        // Find mount point
        progressText.textContent = 'Finding USB mount point...';
        progressBar.style.width = '15%';

        let destPath = null;

        // Try to get mount point from partition
        try {
            const mountCheck = await execAsync(`diskutil info ${dataPartition}`);

            if (mountCheck.stdout.includes('Mounted:               Yes') ||
                mountCheck.stdout.includes('Mounted: Yes')) {
                const mountMatch = mountCheck.stdout.match(/Mount Point:\s+(.+)/);
                if (mountMatch && mountMatch[1].trim() !== '') {
                    destPath = mountMatch[1].trim();
                }
            }
        } catch (e) {
            console.error('Error checking mount status:', e);
        }

        // If not mounted, try to mount it
        if (!destPath) {
            try {
                await execAsync(`diskutil mount ${dataPartition}`);
                await new Promise(resolve => setTimeout(resolve, 2000));

                const remountCheck = await execAsync(`diskutil info ${dataPartition}`);
                const mountMatch = remountCheck.stdout.match(/Mount Point:\s+(.+)/);
                if (mountMatch && mountMatch[1].trim() !== '') {
                    destPath = mountMatch[1].trim();
                }
            } catch (mountError) {
                throw new Error(`Failed to mount USB partition: ${mountError.message}`);
            }
        }

        // Validate mount path
        if (!destPath || destPath === '') {
            throw new Error('Could not find USB mount point. Please try formatting the USB first.');
        }

        // Verify the path exists
        const fs = require('fs');
        if (!fs.existsSync(destPath)) {
            throw new Error(`USB mount point does not exist: ${destPath}`);
        }

        console.log(`Using USB mount point: ${destPath}`);

        // Mount ISO
        progressText.textContent = 'Mounting Windows ISO...';
        progressBar.style.width = '20%';

        const mountResult = await execAsync(`hdiutil mount "${selectedISO}"`);
        const mountPoint = mountResult.stdout.match(/\/Volumes\/[^\s]+/)[0];

        // Copy files with real-time progress
        progressText.textContent = 'Copying Windows files (5-10 minutes)...';
        progressBar.style.width = '30%';

        // Ensure paths don't have trailing slashes and are properly escaped
        const sourcePath = mountPoint.replace(/\/$/, '');
        const targetPath = destPath.replace(/\/$/, '');

        // Get copy method preference
        const copyMethod = document.querySelector('input[name="copymethod"]:checked').value;

        // Use spawn for better progress handling
        const { spawn } = require('child_process');

        // Show USB space monitor and file copy info
        document.getElementById('usbSpaceMonitor').classList.remove('hidden');
        document.getElementById('fileCopyInfo').classList.remove('hidden');

        // Start monitoring USB space in parallel
        let spaceMonitor = setInterval(async () => {
            try {
                const spaceInfo = await execAsync(`df -h "${targetPath}"`);
                const lines = spaceInfo.stdout.split('\n');
                if (lines.length > 1) {
                    const parts = lines[1].split(/\s+/);
                    const total = parts[1];
                    const used = parts[2];
                    const available = parts[3];
                    const percentRaw = parts[4].replace('%', '');
                    const percent = parseInt(percentRaw);

                    // Update UI elements
                    document.getElementById('usbSpaceText').textContent = `${percent}% Full`;
                    document.getElementById('usbSpaceBar').style.width = `${percent}%`;
                    document.getElementById('usbUsedSpace').textContent = `Used: ${used}`;
                    document.getElementById('usbTotalSpace').textContent = `Total: ${total}`;

                    // Change color based on usage
                    const spaceBar = document.getElementById('usbSpaceBar');
                    if (percent > 80) {
                        spaceBar.className = 'bg-gradient-to-r from-red-500 to-orange-500 h-full transition-all duration-500';
                    } else if (percent > 50) {
                        spaceBar.className = 'bg-gradient-to-r from-yellow-500 to-green-500 h-full transition-all duration-500';
                    } else {
                        spaceBar.className = 'bg-gradient-to-r from-green-500 to-blue-500 h-full transition-all duration-500';
                    }

                    console.log(`💾 USB Space: ${used} used, ${available} available (${percent}%)`);
                }
            } catch (e) {
                // Ignore errors during monitoring
            }
        }, 2000); // Update every 2 seconds

        await new Promise((resolve, reject) => {
            let copyProcess;

            if (copyMethod === 'cp') {
                // Use cp -R for FASTEST copying (native macOS, no overhead)
                // This is significantly faster than rsync for local copying
                progressText.textContent = '📁 Fast copying mode - Maximum speed!';
                document.getElementById('transferSpeed').textContent = 'Using native cp (fastest)';

                copyProcess = spawn('cp', [
                    '-Rv',  // -R: recursive, -v: verbose
                    `${sourcePath}/.`,  // Copy contents
                    targetPath
                ]);
            } else {
                // Optimized rsync with faster options:
                // -a: archive mode
                // -h: human-readable sizes
                // --progress: show progress
                // --inplace: update files in-place (faster, no temp files)
                // --no-compress: don't compress (USB is local, compression slows down)
                // --whole-file: copy whole files (faster for local transfers)
                copyProcess = spawn('rsync', [
                    '-ah',
                    '--progress',
                    '--inplace',
                    '--no-compress',
                    '--whole-file',
                    `${sourcePath}/`,
                    `${targetPath}/`
                ]);
            }

            const rsyncProcess = copyProcess;  // Keep variable name for compatibility

            let errorOutput = '';
            let lastFile = '';
            let fileCount = 0;
            let currentFile = '';
            let totalFiles = 0;

            rsyncProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(output);

                if (copyMethod === 'cp') {
                    // cp outputs filename per line with verbose mode
                    const lines = output.split('\n');
                    for (const line of lines) {
                        if (line.trim().length > 0) {
                            fileCount++;

                            // Update UI every 30 files
                            if (fileCount % 30 === 0) {
                                progressText.textContent = `📁 Fast copying: ${fileCount} files...`;
                                document.getElementById('fileCountText').textContent = `Files copied: ${fileCount}`;

                                // Estimate progress (Windows ISO ~4000 files)
                                const estimatedProgress = Math.min(85, 30 + (fileCount / 45));
                                progressBar.style.width = `${estimatedProgress}%`;
                            }
                        }
                    }
                } else {
                    // rsync progress parsing
                    const lines = output.split('\n');
                    for (const line of lines) {
                        const trimmed = line.trim();

                        // Check for file transfer lines
                        if (trimmed &&
                            !trimmed.startsWith('sending') &&
                            !trimmed.startsWith('total size') &&
                            !trimmed.startsWith('sent') &&
                            !trimmed.startsWith('receiving') &&
                            !trimmed.match(/^\d+\s+\d+%/) &&
                            trimmed.length > 3 &&
                            !trimmed.includes('speedup')) {

                            currentFile = trimmed;
                            fileCount++;

                            // Update UI every 20 files
                            if (fileCount % 20 === 0) {
                                progressText.textContent = `📁 Copying: ${fileCount} files...`;
                                document.getElementById('fileCountText').textContent = `Files copied: ${fileCount}`;

                                const estimatedProgress = Math.min(85, 30 + (fileCount / 50));
                                progressBar.style.width = `${estimatedProgress}%`;
                            }
                        }

                        // Check for progress percentage
                        const progressMatch = trimmed.match(/(\d+)\s+(\d+)%/);
                        if (progressMatch) {
                            const percent = parseInt(progressMatch[2]);
                            const adjustedPercent = 30 + (percent * 0.6);
                            progressBar.style.width = `${adjustedPercent}%`;
                        }

                        // Check for transfer rate
                        const rateMatch = trimmed.match(/(\d+\.?\d*[KMG]B\/s)/);
                        if (rateMatch) {
                            document.getElementById('transferSpeed').textContent = `Speed: ${rateMatch[1]}`;
                        }
                    }
                }
            });

            rsyncProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error(data.toString());
            });

            rsyncProcess.on('close', (code) => {
                clearInterval(spaceMonitor); // Stop monitoring

                // Hide monitors after completion
                setTimeout(() => {
                    document.getElementById('usbSpaceMonitor').classList.add('hidden');
                    document.getElementById('fileCopyInfo').classList.add('hidden');
                }, 3000);

                if (code === 0) {
                    progressText.textContent = `✅ Copied ${fileCount} files successfully!`;
                    document.getElementById('fileCountText').textContent = `✅ Total files copied: ${fileCount}`;
                    resolve();
                } else {
                    reject(new Error(`rsync failed with code ${code}: ${errorOutput}`));
                }
            });
        });

        progressBar.style.width = '90%';

        // Unmount ISO
        progressText.textContent = 'Cleaning up...';
        await execAsync(`hdiutil unmount "${mountPoint}"`);

        progressBar.style.width = '100%';
        progressText.textContent = '✅ Bootable USB created successfully!';

        setTimeout(() => {
            const successMessage = `
╔═══════════════════════════════════════╗
║   ✅ BOOTABLE USB CREATED SUCCESSFULLY!   ║
╚═══════════════════════════════════════╝

Your bootable Windows USB is ready!

📋 What's next:
1. Safely eject the USB drive
2. Insert it into your Dell laptop
3. Boot from USB (press F12 during startup)
4. Follow Windows installation wizard

✅ USB is now bootable and ready to use!
            `.trim();

            alert(successMessage);
            progressContainer.classList.add('hidden');

            // Also update the progress text to show success
            progressText.textContent = '✅ Done! You can now safely eject the USB.';
            progressText.classList.add('text-green-600', 'font-bold');
        }, 1500);

    } catch (error) {
        progressContainer.classList.add('hidden');
        alert('Error making bootable:\n\n' + error.message);
        console.error(error);
    }
}

// OLD FUNCTION - keeping for compatibility
async function createBootableUSB() {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Validate selections
    if (!selectedISO) {
        alert('Please select an ISO file first');
        return;
    }

    const usbDrive = document.getElementById('usbDrive').value;
    if (!usbDrive) {
        alert('Please select a USB drive');
        return;
    }

    const partition = document.querySelector('input[name="partition"]:checked').value;
    const filesystem = document.querySelector('input[name="filesystem"]:checked').value;

    // Confirm action
    const confirmed = confirm(`⚠️ WARNING ⚠️\n\nThis will ERASE ALL DATA on ${usbDrive}\n\nAre you sure you want to continue?`);
    if (!confirmed) return;

    // Show progress
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';

    try {
        // Step 0: Get sudo password using osascript
        progressText.textContent = 'Requesting administrator password...';
        progressBar.style.width = '5%';

        let sudoPassword;
        try {
            const passwordPrompt = await execAsync(
                `osascript -e 'Tell application "System Events" to display dialog "Enter your Mac password to create bootable USB:" default answer "" with hidden answer with title "Administrator Access Required"' -e 'text returned of result'`
            );
            sudoPassword = passwordPrompt.stdout.trim();
        } catch (e) {
            throw new Error('Password entry cancelled');
        }

        // Step 1: Unmount the disk
        progressText.textContent = 'Unmounting disk...';
        progressBar.style.width = '10%';
        await execAsync(`diskutil unmountDisk ${usbDrive}`);

        // Step 2: Format the disk with password
        progressText.textContent = `Formatting as ${filesystem.toUpperCase()}...`;
        progressBar.style.width = '25%';

        const partitionScheme = partition === 'gpt' ? 'GPT' : 'MBR';
        const fsFormat = filesystem === 'fat32' ? 'MS-DOS FAT32' :
                        filesystem === 'exfat' ? 'ExFAT' : 'MS-DOS';

        await execAsync(`echo "${sudoPassword}" | sudo -S diskutil eraseDisk "${fsFormat}" WINDOWS ${partitionScheme} ${usbDrive}`, {
            timeout: 60000
        });

        // Step 3: Wait for disk to be ready and find mount point
        progressText.textContent = 'Waiting for disk to be ready...';
        progressBar.style.width = '40%';

        // Wait a bit for the disk to settle after formatting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check if disk is already mounted or mount it
        let destPath = '/Volumes/WINDOWS';
        try {
            const mountCheck = await execAsync(`diskutil info ${usbDrive}s1`);
            if (mountCheck.stdout.includes('Mounted:               Yes')) {
                const mountMatch = mountCheck.stdout.match(/Mount Point:\s+(.+)/);
                if (mountMatch) {
                    destPath = mountMatch[1].trim();
                }
            } else {
                await execAsync(`diskutil mount ${usbDrive}s1`);
            }
        } catch (e) {
            // Try to mount anyway
            try {
                await execAsync(`diskutil mount ${usbDrive}s1`);
            } catch (mountErr) {
                // Check if already mounted with different name
                const volList = await execAsync('ls /Volumes');
                const volumes = volList.stdout.split('\n').filter(v => v.trim());
                // Use the most recently created volume
                destPath = `/Volumes/${volumes[volumes.length - 1]}`;
            }
        }

        // Step 4: Copy ISO contents
        progressText.textContent = 'Copying Windows files (this may take several minutes)...';
        progressBar.style.width = '50%';

        // Mount ISO
        const mountResult = await execAsync(`hdiutil mount "${selectedISO}"`);
        const mountPoint = mountResult.stdout.match(/\/Volumes\/[^\s]+/)[0];

        // Copy files
        await execAsync(`rsync -av --progress "${mountPoint}/" "${destPath}/"`, {
            timeout: 600000 // 10 minutes timeout
        });

        progressBar.style.width = '90%';

        // Step 5: Unmount ISO
        progressText.textContent = 'Cleaning up...';
        await execAsync(`hdiutil unmount "${mountPoint}"`);

        // Step 6: Eject USB
        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';

        setTimeout(() => {
            alert('✅ Bootable USB created successfully!\n\nYou can now safely eject the USB drive and use it to boot.');
            progressContainer.classList.add('hidden');
        }, 1000);

    } catch (error) {
        progressContainer.classList.add('hidden');
        alert('Error creating bootable USB:\n\n' + error.message + '\n\nMake sure you have administrator privileges.');
        console.error(error);
    }
}

// Refresh USB devices on load
window.addEventListener('load', () => {
    refreshUSBDevices();
});
