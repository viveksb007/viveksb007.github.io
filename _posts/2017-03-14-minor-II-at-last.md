---
layout: post
title: "Minor II : At Last"
date: 2017-03-14
tags: [project, self-driving]
comments: true
---

So its my 6th semester and time to decide some idea to work on as Minor II. After Minor I in which I made Advanced Attendance System ( for which i got way more marks than I should have :P ).

### A brief review of Minor I : **ADVANCED ATTENDANCE SYSTEM**
The project is basically a set of two Applications that run on smartphone. One Called Attendance Server that runs on Teachers phone and other Attendance Client that runs on Students phone.

**Attendance Server:** This Application makes use of wi-fi of smartphone to open an Access Point ( AP ) or wi-fi hot-spot, for Client applications to connect and mark attendance. It also opens a server ( Attendance Server ) that manages the incoming data from Client Applications and stores them in a database for others tasks like synchronising attendance data with some Cloud Server for students to see their attendance progress.

**Attendance Client:** This Application makes use of wi-fi of smartphone to connect to Access Point created by Server App. When Mark Attendance is clicked it sends it's device ID and Roll No to Server App, device ID is used to filter phones to prevent proxy.

**_Attendance Server : https://github.com/viveksb007/AttendanceServer_**<br/>
**_Attendance Client : https://github.com/viveksb007/AttendanceClient_**

### Idea for Minor II : **SELF DRIVING RC CAR** ( idea credits : Jiten Sardana )<br/>
**"Self driving RC Car"** name sounds cool right but the way its going to implemented is more cool. Without any delay, lets dive into implementation details.

<img src="/assets/img/projects/self_driving_prototype.png" alt="Self Driving Prototype" style="display: block; margin-left: auto; margin-right: auto;"/>

First I will mount Android Phone on a RC Car to capture Live Feed from car. For this I made an Android App that transfers live camera feed from Android to Desktop and open-sourced it. Source can be found at [LiveFeed](https://github.com/viveksb007/LiveFeed).<br/>
At desktop runs a Python script that captures the feed. Android hot-spot is used as communication interface between Android and Desktop. Now I have the view what the car has.<br/>
Coming to II step, Interface RC car's remote to arduino and connect arduino to PC for Serial communication. Now we need to train the network ( YES NEURAL NETWORK IS USED :D ). I will drive the car by watching feed on desktop and controlling it through arrow keys which give signal to arduino serially which in turn signals car through RC remote. Question : How network is trained? While I drive and press arrow button at that instance, frame of feed is saved with corresponding arrow key. So, the network knows which key was pressed at which frame, doing this for N times will improve network accuracy. Lets leave accuracy aside for now. So now we have a trained network.<br/>
Using this network car would drive itself, frame from feed is given to network as input and gets arrow key as output which is given to arduino which controls car through RC remote. This almost covers all the implementation steps.<br/>
Python is used for neural network implementation for this project and pyserial module for serial communication with Arduino.

Repository for scripts used : [https://github.com/viveksb007/SD_CAR_MINOR](https://github.com/viveksb007/SD_CAR_MINOR)