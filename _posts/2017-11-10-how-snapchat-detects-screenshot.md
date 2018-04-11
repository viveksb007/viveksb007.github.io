---
layout: post
title: "How Snapchat detects when screenshot is taken (Hypothesis)"
date: 2017-11-10
tags: [snapchat, snap screenshot]
comments: true
---

<img src="/assets/img/social-lg.jpg" alt="Snapchat" style="display: block; margin-left: auto; margin-right: auto;"/>

While my friend was playing **_"That Level Again"_** game he mentioned there was a level in between when he had to take screenshot of Game Screen to pass that level (Weird right!). As I know a little bit about Mobile Development I thought they might be having some special permission to do so. To be sure I went ahead and asked to see all the permissions that game app was taking and it was just taking **_READ_STORAGE_SPACE_** permission. Then he mentioned that **Snapchat** also detects when you take screenshot of some other person’s story/chat, it notifies that person that you took a screenshot. That’s violating the rights of a stalker. And you could do that in your App too. Now lets see HOW!

In layman language, you observe screenshot folder for any file created during the time your app in on foreground. If any image is created in screenshot folder when your app is in foreground that means you app's screenshot is taken. Below is implementation details of above method in Android.

So lets see how they might have done it in **code**. If we have **_READ_STORAGE_SPACE_** permission, we can actually attach a listener to any directory of file-system. And screen-shots in most phones are stored in particular directory (probably change from phone to phone, there is a way to detect that too. I would leave that for you to figure out). So when your App opens attach a listener (In this case [FileObserver](https://developer.android.com/reference/android/os/FileObserver.html)) to screen-shot directory and implement its callback methods.

```java
public class MyFileObserver extends FileObserver {
    
    public String absolutePath;
    
    public MyFileObserver(String path) {
        super(path, FileObserver.CREATE);
        absolutePath = path;
    }

    @Override
    public void onEvent(int event, String path) {
        // <path> where file or any directory is created
        if(event == FileObserver.CREATE)
            Log.v(TAG,"Screenshot Taken");
    }
}
```
Create an object of **MyFileObserver** class by passing path of directory you want to attach listener on and do your action in **_onEvent()_** method.

Below I am attaching a listener to **Screenshots** directory, during the time my Activity is on foreground, I am listening to the change in screenshot directory if any new file is created that means screenshot of my app s taken as its on foreground.

```java
MyFileObserver fileObserver = new MyFileObserver(Environment.getExternalStorageDirectory().getAbsolutePath() + "/DCIM/Screenshots");
```
Call **_fileObserver.startWatching()_** in your Activity **_onResume()_** method and **_fileObserver.stopWatching()_** in Activity **_onPause()_**.

This simple code would detect if any screenshot is taken when your App is on foreground. If you find any discrepancy in this method, please let me know at **viveksbhadauria007@gmail.com**

I made an Android App [Snap Screenshot for Snapchat](https://play.google.com/store/apps/details?id=com.viveksb007.snapnscreenshot) which can take screenshot of Snapchat without detection and takes general screenshots too by simply clicking on a floating camera icon. Please try it and review.

<a href="https://play.google.com/store/apps/details?id=com.viveksb007.snapnscreenshot" target="_blank">
<img src="/assets/img/gplay_badge.png" alt="Google Play Badge" style="display: block; margin-left: auto; margin-right: auto;"/>
</a>