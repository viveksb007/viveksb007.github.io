---
author: ["Vivek Bhadauria"]
title: "FFmpeg : Automate Filtering and Editing Videos"
date: 2017-12-08
tags: [automate-filtering, video-editing, ffmpeg-commands]
ShowToc: false
---

Hello again, I am a huge fan of anime, (**Dragon Ball** and **Naruto**) in particular. I saw some channels uploading Anime videos bypassing **YouTube's copyright detection**. So I looked on the ways and mostly involved some video editing software and you have to invest a lot of your time. So I wanted to automate the process that takes in input as a Video and modifies its properties so that it would bypass YouTube's Copyright detection and quality of video should still be watchable.

So lets explore [**FFmpeg**](https://www.ffmpeg.org/) commands first and then we can simply write a bash script to automate the complete process.

To extract audio from the video -
```
ffmpeg -i inputFile.mp4 outputAudio.mp3
```
Add watermark to the video - **watermark.png** would be overlayed at (x,y) -> (10,10) on the frames of **input.mp4**
```
ffmpeg -i input.mp4 -i watermark.png -filter_complex "overlay=10:10" final_video.mp4
```
Extract clip from video whose starting time and ending time is specified -
```
ffmpeg -i final_video.mp4 -c copy -ss 00:03:54 -to 00:22:02 output_file.mp4
```
Increase Audio speed by 10% - If you have a general audio file and you want to speed up the audio, below command can be used
```
ffmpeg -i testAudio.mp3 -filter:a "atempo=1.1" -vn audio_final.mp3
```
Increase video speed by 10% -
```
ffmpeg -i input.mp4 -filter:v "setpts=0.9*PTS" output.mp4
```
Increase audio and video speed together using complex filtergraph - this is similar to when you speed up the YouTube Videos or increase playback speed in VLC player.
```
ffmpeg -i input.mkv -filter_complex "[0:v]setpts=0.5*PTS[v];[0:a]atempo=2.0[a]" -map "[v]" -map "[a]" output.mkv
```
To increase volume by 10dB - you must have seen videos whose sound is quite less even if you are listening on MAX volume, that's because embedded audio level is low, below command would increase the audio level by 10dB. Change value to 20dB, 30dB and so on depending on how much audio level you want to increase.
```
ffmpeg -i inputfile -vcodec copy -af "volume=10dB" outputfile
```
To decrease volume by 5dB - Similar to increasing audio level, you can also decrease audio level of an independent audio file or audio embedded inside a video.
```
ffmpeg -i inputfile -vcodec copy -af "volume=-5dB" outputfile
```
Remove audio from video file - If you want to mute the audio of a video file, you can use the command below to extract a muted video file.
```
ffmpeg -i inputFile.mp4 -an -vcodec copy outputFile.mp4
```

I have listed some commands which are used most frequently. To automate the filtering and editing process, we can write a pipeline in which video would be edited in stages. Starting from the input video, output of one level would be input to another level and finally output video is saved. All intermediate files are removed.

Shell Programming with bash : [http://matt.might.net/articles/bash-by-example/](http://matt.might.net/articles/bash-by-example/)
