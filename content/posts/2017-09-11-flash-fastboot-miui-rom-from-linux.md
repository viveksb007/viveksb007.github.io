---
author: ["Vivek Bhadauria"]
title: "Flash Fastboot MIUI ROM from Linux"
date: 2017-09-11
tags: [flash-ROM, bootloop, MIUI ROM]
ShowToc: false
TocOpen: true
cover:
  image: img/flash_fastboot_rom.png
---

Sometimes during switching between ROM on your android device, you can do the following things
- Stuck in bootloop (phone is stuck on MI logo while booting)
- Brick your device accidentally :P
- Or some other irrecoverable problem during rooting or changing recovery

When nothing works, you have to flash ROM through fastboot. This post describes how you can flash fastboot MIUI Rom from your Linux system. And it's super easy compared to windows. I would take Redmi 3S Prime (land) ROM for example in the terminal commands, change the ROM name according to your needs.

To enter into fastboot mode press **_volume down + power button_**.

### First Download Fastboot MIUI ROM For Your Android Device
Head over to Xiaomi MIUI forum and select ROM for your device<br/>
Forum Link : [http://en.miui.com/a-234.html](http://en.miui.com/a-234.html)

Once its downloaded extract it using default Archive Manager or using following command:
```
tar -xvzf land_global_images_7.9.8_20170908.0000.00_6.0_global_5524854df9.tgz
```

### Install Android ADB tools and Fastboot tools
For ADB (Android Debug Bridge)
```
sudo apt-get install android-tools-adb
```
For Fastboot tools
```
sudo apt-get install android-tools-fastboot
```
### Change To Extracted ROM Directory
```
cd land_global_images_7.9.8_20170908.0000.00_6.0_global
```

![Fastboot ROM Folder](/img/directory_screenshot.png)

Inside the extracted ROM directory, there are many scripts like

- **flash_all.sh:** This script would flash everything i.e everything from your phone would be erased similar to when your phone was new.
- **flash_all_except_data_storage.sh:** This script would save your data and flash other
- **flash_all_lock.sh:** This script would flash everything and lock the bootloader after flashing.

The following is a list of Android Partitions:
- `/boot`
- `/system`
- `/recovery`
- `/data`
- `/cache`
- `/misc`

Different scripts flash different set of partitions. Further explanation is out of scope for this post. Choose script that suits your flashing needs, it would be most probably **_flash_all_except_data_storage.sh_** as you want to save the user data.

### Give Execution Permission to Script and Run Script
```
sudo chmod +x flash_all_except_data_storage.sh
```
```
sudo sh flash_all_except_data_storage.sh
```
Now the ROM flashing would start and phone would reboot automatically when the flashing ends.