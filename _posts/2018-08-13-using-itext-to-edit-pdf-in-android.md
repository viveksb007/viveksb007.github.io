---
layout: post
title: "Using iText To Edit PDF In Android"
date: 2018-08-13
tags: [android, iText]
youtubeId: tagq7M_vvag
youtubeId1: tANTbMUk7jc
comments: true
---

In this article, we are going to learn how to integrate and use [iText](https://github.com/itext/itextpdf) library to edit PDFs in Android. You app idea might require you to create or edit PDF as an intermediate or final step. [iText](https://github.com/itext/itextpdf) is the best library to create or edit PDFs.

## Integrate iText in your Project

Adding iText is similar to adding any other library/dependency in your android project. Add statement below in you _**app.gradle**_ file

```groovy
implementation 'com.itextpdf:itextg:5.5.10'
``` 

Replace **5.5.10** with the current version. At the time of writing this post **5.5.10** is the latest version. You can see latest release [here](http://github.com/itext/itextpdf/releases/latest).

## Problem and Motivation

Now the you have integrated iText in your project, you can use its APIs to open and modify PDFs. I didn't found a separate API documentation for Android, but [iText7 examples](https://developers.itextpdf.com/content/itext-7-examples) can be referred to get basic understanding of how things work.

I wanted to make an Android App to remove watermark "**Scanned by CamScanner**" from PDFs which were created by [CamScanner](https://play.google.com/store/apps/details?id=com.intsig.camscanner&hl=en_IN) App.

If you have ever scanned documents from CamScanner, you must have noticed that watermark "**Scanned by CamScanner**" is always on lower right part which is footer of PDF actually. You can see the same in the image below

<img src="/assets/img/cmos_class_notes.png" alt="CMOS class notes" style="display: block; margin-left: auto; margin-right: auto;"/>

There are quite a few ways to get rid of the watermark below. Some are listed below:

- Cut lower rectangular part of dimension (**page width x magic number**) magic number is height of page from below just above the watermark. But this would reduce the page height (difference is not visible in pdf).
- Overlay white rectangle of dimension (**page width x magic number**) such that it only covers the watermark and none of the PDF content. (This is the approach that I used)
- Access PDF footer programmatically and remove watermark text. I didn't look much for a way to accomplish this. If you have some idea, feel free to comment.

If you have some other way to remove watermark from PDF, let me know in comments. I will update the post with proper credits.

## Code Implementation

Now that I want to overlay a white rectangle over the PDF page such that only watermark is covered and no PDF content is lost. I made a function _**modifyPDF()**_ that takes the address of the source and destination pdf (_destination pdf would be created in the process_).

NOTE: Make sure that SRC and DEST are not same. The app would crash if SRC and DEST are same.

Below is the function _**modifyPDF()**_ which takes _**src(Source)**_ and _**dest(Destination)**_, reads source PDF using _**PdfReader**_, modifies PDF in this case overlays a white rectangle in the lower part of every page of PDF. Dimension of rectangle is page width x 20. Value 20 is found by trial and error. You should give [this](https://developers.itextpdf.com/question/how-should-i-interpret-coordinates-rectangle-pdf) a read before interpreting rectangle dimensions w.r.t PDF page.

```java
private void modifyPDF(String src, String dest) throws IOException, DocumentException {
    /*Ref - https://developers.itextpdf.com/examples/stamping-content-existing-pdfs-itext5/changing-page-sizes-existing-pdfs*/
    PdfReader reader = new PdfReader(src);
    int n = reader.getNumberOfPages();
    PdfStamper stamper = new PdfStamper(reader, new FileOutputStream(dest));
    PdfContentByte over;
    PdfDictionary pageDict;
    PdfArray mediaBox;
    float llx, lly, ury, urx;
    for (int i = 1; i <= n; i++) {
        pageDict = reader.getPageN(i);
        mediaBox = pageDict.getAsArray(PdfName.MEDIABOX);
        llx = mediaBox.getAsNumber(0).floatValue();
        lly = mediaBox.getAsNumber(1).floatValue();
        urx = mediaBox.getAsNumber(2).floatValue();
        ury = mediaBox.getAsNumber(3).floatValue();
        over = stamper.getOverContent(i);
        over.saveState();
        over.setColorFill(new GrayColor(1.0 f));
        over.rectangle(llx, lly, urx, 20);
        over.fill();
        over.restoreState();
    }
    stamper.close();
    reader.close();
}
```

## Source Code

APK of Watermark Remove for CamScanner : [https://github.com/viveksb007/camScannerWatermarkRemoverAndroid/blob/master/app/release/app-release.apk](https://github.com/viveksb007/camScannerWatermarkRemoverAndroid/blob/master/app/release/app-release.apk)

Source code of Android App : [https://github.com/viveksb007/camScannerWatermarkRemoverAndroid](https://github.com/viveksb007/camScannerWatermarkRemoverAndroid)

{% include youtubeplayer.html id=page.youtubeId %}


## I also made a Flask App which tackles the same problem.


{% include youtubeplayer.html id=page.youtubeId1 %}


Source Code of Flask App : [https://github.com/viveksb007/camscanner\_watermark\_remover](https://github.com/viveksb007/camscanner_watermark_remover)

## References

1. https://developers.itextpdf.com/content/itext-7-jump-start-tutorial
2. https://developers.itextpdf.com/question/how-should-i-interpret-coordinates-rectangle-pdf
3. https://stackoverflow.com/questions/26773942/itext-crop-out-a-part-of-pdf-file

**Android Apps by VB Applications :** [https://play.google.com/store/apps/developer?id=VB+Applications](https://play.google.com/store/apps/developer?id=VB+Applications)
