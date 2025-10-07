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
        progressText.textContent = 'Format complete!';

        setTimeout(() => {
            alert('✅ USB formatted successfully!\n\nNow click "2. Make Bootable" to copy Windows files.');
            progressContainer.classList.add('hidden');
        }, 1000);

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

        let destPath = '/Volumes/WINDOWS';
        const mountCheck = await execAsync(`diskutil info ${dataPartition}`);
        if (mountCheck.stdout.includes('Mounted:               Yes')) {
            const mountMatch = mountCheck.stdout.match(/Mount Point:\s+(.+)/);
            if (mountMatch) {
                destPath = mountMatch[1].trim();
            }
        } else {
            await execAsync(`diskutil mount ${dataPartition}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const remountCheck = await execAsync(`diskutil info ${dataPartition}`);
            const mountMatch = remountCheck.stdout.match(/Mount Point:\s+(.+)/);
            if (mountMatch) {
                destPath = mountMatch[1].trim();
            }
        }

        // Mount ISO
        progressText.textContent = 'Mounting Windows ISO...';
        progressBar.style.width = '20%';

        const mountResult = await execAsync(`hdiutil mount "${selectedISO}"`);
        const mountPoint = mountResult.stdout.match(/\/Volumes\/[^\s]+/)[0];

        // Copy files
        progressText.textContent = 'Copying Windows files (5-10 minutes)...';
        progressBar.style.width = '30%';

        await execAsync(`rsync -av --progress "${mountPoint}/" "${destPath}/"`, {
            timeout: 600000
        });

        progressBar.style.width = '90%';

        // Unmount ISO
        progressText.textContent = 'Cleaning up...';
        await execAsync(`hdiutil unmount "${mountPoint}"`);

        progressBar.style.width = '100%';
        progressText.textContent = 'Complete!';

        setTimeout(() => {
            alert('✅ Bootable USB created successfully!\n\nYou can now boot your Dell laptop from this USB drive!');
            progressContainer.classList.add('hidden');
        }, 1000);

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
