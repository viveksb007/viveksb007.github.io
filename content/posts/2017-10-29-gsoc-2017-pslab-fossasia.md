---
author: ["Vivek Bhadauria"]
title: "GSOC - 17 Pocket Science Lab : FOSSASIA"
date: 2017-10-29
tags: [gsoc, pslab, android, fossasia]
ShowToc: false
TocOpen: true
---

This is a little late for this post but anyways I drafted it during the GSOC-17 only, so I am posting it with some modification.

My proposal for FOSSASIA PSLab was selected. 
### Title : Develop an Android Science App for PSLab Experiments.

A brief intro about [Pocket Science Lab](https://pslab.fossasia.org/), its an Open Source Hardware Device which provides a lot of functionality that is required to perform a general scientific experiment. You can do a lot of other activities like monitoring motion using MPU6050 sensor by the add-on sensors which the device support. The device supports many sensors complete list can be seen [here](https://github.com/fossasia/pslab-android/tree/development/app/src/main/java/org/fossasia/pslab/sensorfragment). Python Client for PSLab supports more sensors, a list can be viewed [here](https://github.com/fossasia/pslab-python/tree/development/PSL/SENSORS).

Current Applications of PSLab are :
- 4-Channel, up to 2 msps (millions of samples per second) Oscilloscope
- Shows variation of analog signals (constantly varying signals)
- 4-Channels for Logic Analyzer
- Captures and displays signals from digital system
- 2 Sine Wave Generators, Frequency Range (5Hz - 5KHz)
- 4 PWM (Pulse Width Modulation) Wave Generator, Range up to 8MHz
- Capacitance Measurement, Range (pF-uF)
- 3 12-bit Programmable Voltage Sources
- 12-bit Programmable Current Source
- I2C/SPI/UART data-buses for Accelerometer/Gyroscope/humidity/temperature sensors etc
- Supports other Add ons/Advanced Plugins

For details about hardware and firmware for PSLab Device, Refer ReadMe of corresponding repository.
- [**PSLab Firmware**](https://github.com/fossasia/pslab-firmware)
- [**PSLab Hardware**](https://github.com/fossasia/pslab-hardware)

My project for Summer 2017 involves making an Android Client for PSLab Device. In short you can do the experiments by connecting your mobile phone with device through OTG cable. To be precise, here is abstract that I gave for GSOC

>"Create an Android App from scratch which would enable user to use PSLab directly from their mobile phone through an OTG cable and perform various experiments and get output from App itself. Many PSLab experiments have been already implemented in Python. They can be ported to Android and can be performed directly from the phone."

There were other devs (Jithin, Akarshan, Padmal, Asitva) who were working along with me for the Pocket Science Lab. Mentors (Mario, Praveen, Lorenz) were awesome and helped a lot during the GSOC programme.

My blog posts during the GSOC-17 period can be viewed at FOSSASIA's blog
- [Android App Debugging Over Wi-Fi For PSLab](https://blog.fossasia.org/android-app-debugging-over-wifi-for-pslab/)
- [Establishing Communication Between PSLab And An Android Device Using The USB Host API](https://blog.fossasia.org/establishing-communication-between-pslab-and-an-android-device-using-the-usb-host-api/)
- [Communication by PySerial Python Module in PSLab](https://blog.fossasia.org/communication-by-pyserial-python-module-in-pslab/)
- [Packing and Unpacking Data in PSLab Android App](https://blog.fossasia.org/packing-and-unpacking-data-in-pslab-android-app/)
- [Handling Graph Plots Using MPAndroid Chart in PSLab Android App](https://blog.fossasia.org/handling-graph-plots-using-mpandroid-chart-in-pslab-android-app/)
- [Expandable ListView in PSLab Android App](https://blog.fossasia.org/expandable-listview-in-pslab-android-app/)
- [Plotting Digital Logic Lines in PSLab Android App](https://blog.fossasia.org/plotting-digital-logic-lines-in-pslab-android-app/)
- [Open Local HTML Files in PSLab Android App](https://blog.fossasia.org/opening-local-html-files-in-pslab-android-app/)
- [Making Custom Change Listener in PSLab Android App](https://blog.fossasia.org/making-custom-change-listeners-in-pslab-android/)
- [Using AudioJack to make Oscilloscope in the PSLab Android App](https://blog.fossasia.org/using-the-audio-jack-to-make-an-oscilloscope-in-the-pslab-android-app/)
- [Performing The Experiments Using The PSLab Android App](https://blog.fossasia.org/performing-the-experiments-using-the-pslab-android-app/)
- [Implementing Experiment Functionality in PSLab Android App](https://blog.fossasia.org/implementing-experiment-functionality-in-pslab-android/)
- [Implement Wave Generation Functionality in PSLab Android App](https://blog.fossasia.org/implement-wave-generation-functionality-in-the-pslab-android-app/)
- [Sensor Data Logging in PSLab Android App](https://blog.fossasia.org/sensor-data-logging-in-the-pslab-android-app/)
- [Export Sensor Data From The PSLab Android App](https://blog.fossasia.org/export-sensor-data-from-the-pslab-android-app/)
- [Filling Audio Buffer to Generate Waves in the PSLab Android App](https://blog.fossasia.org/filling-audio-buffer-to-generate-waves-in-the-pslab-android-app/)

Above are links to all the blog posts that I wrote during development of the PSLab Android App.

Link of gist that I submitted for final evaluation : [GSOC-17 Report Vivek](https://gist.github.com/viveksb007/b394b5815ebe4208435509ce40ec4521)
