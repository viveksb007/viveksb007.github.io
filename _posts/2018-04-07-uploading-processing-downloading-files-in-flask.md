---
layout: post
title: "Uploading, Processing and Downloading Files in Flask"
date: 2018-04-07
tags: [flask, uploading, downloading]
youtubeId: tANTbMUk7jc
comments: true
---

In this article, we are going to learn how to handle files from server i.e how to facilitate uploading and download for files in Flask. This is quite a common requirement for webapps nowadays. Some examples are :
- All the image editing sites online require uploading of image, then process them online and provide processed image for downloading.
- Sites that allow users to edit pdf online require uploading, processing and allowing users to download processed file.

There are many examples of using this functionality. So in this post we will see :
- How to provide interface to user for uploading a file
- Process file on server side
- Allow user to download processes file

We will be creating back-end to remove watermark from pdf files. For that we need to get user file, process (remove watermark from pdf file) and provide processed file to user for download.

### Interface for Uploading a File
We will create a simple HTML page that provides a button to select file and another button to upload that file. Let the HTML page be **_index.html_**
```
<!DOCTYPE html>
<html lang="en">
<head>
   <meta charset="UTF-8">
   <title>Watermark Remover</title>
</head>
<body>
<div align="center">
   <h1>Cam-Scanner Watermark Remover</h1>
   <h2>Upload new File</h2>
   <form method=post enctype=multipart/form-data>
       <p><input type=file name=file>
           <input type=submit value=Upload>
   </form>
</div>
</body>
</html>
```

**form** tag is used to create a POST request.
- **method** attribute of form tag specifies the HTTP method to use when form is submitted.
    - **get:** form data is appended to the URL when submitted
    - **post:** form data is not appended to the URL
- **enctype:** specifies the encoding type of the form. application/x-www-form-urlencoded is the default value if the enctype is not specified. multipart/form-data is necessary if users want to upload a file through the form.

<img src="/assets/img/watermark_remover_screenshot.png" alt="Camscanner Watermark Remover" style="display: block; margin-left: auto; margin-right: auto;"/>

Now we render this page as the main page i.e index page. We need to specify a directory to the Flask app where the uploaded files would be stored.
```python
UPLOAD_FOLDER = os.path.dirname(os.path.abspath(__file__)) + '/uploads/'
```
Above line creates a **uploads** folder in the same directory where the src code of the site is stored.

We should also check for file extension that the user is uploading as there would be some specific type of file that the site can process. Also there is security issue if the user can upload any type of file. User might upload html file that can cause **XSS (cross site-scripting)** problems.

For this post, we only need pdf file extensions as this Flask app would remove watermark from pdf files created by [**CamScanner App**](https://play.google.com/store/apps/details?id=com.intsig.camscanner&hl=en) (Famous App for scanning documents through Mobile Camera). Pdf files would have watermark at the bottom similar to what is shown in the image below :

<img src="/assets/img/watermark_screenshot.png" alt="Camscanner Watermark Screenshot" style="display: block; margin-left: auto; margin-right: auto;"/>

```python
ALLOWED_EXTENSIONS = {'pdf'}
def allowed_file(filename):
   return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
```
**filename** is passed as an argument to **allowed_file** function. Function checks the filename for allowed file extension and if file type is supported the function returns **True** otherwise it returns **False**.

We can add more extension types in allowed extensions set for supporting different type of file uploads.
```python
from flask import Flask, request, redirect, url_for, render_template, send_from_directory
from werkzeug.utils import secure_filename

@app.route('/', methods=['GET', 'POST'])
def index():
   if request.method == 'POST':
       if 'file' not in request.files:
           print('No file attached in request')
           return redirect(request.url)
       file = request.files['file']
       if file.filename == '':
           print('No file selected')
           return redirect(request.url)
       if file and allowed_file(file.filename):
           filename = secure_filename(file.filename)
           file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
           process_file(os.path.join(app.config['UPLOAD_FOLDER'], filename), filename)
           return redirect(url_for('uploaded_file', filename=filename))
   return render_template('index.html')
```
In the above method, it can be clearly seen that the **index** method supports both **GET** and **POST** requests. It returns the **index.html** page when the browser sends a GET request and saves the uploaded file, processes it and returns processed file when POST request is made.

Uploaded file attached in the POST request can be referenced by **request.files[‘file’]**. This file needs to be saved in the **UPLOAD_FOLDER** path that we created earlier. We check the name of the uploaded file before we save it to server filesystem.<br/>
Note that we used **secure_filename** function to obtain filename which we use to store file in the server filesystem. This is done because there is a possibility that user might name the file which clashes with some system configuration file, In this case if uploaded filename is not changed then system file will be overwritten. This vulnerability can be used by hackers to hack the server. So using **secure_filename** is always advised.

### Processing Uploaded File
After file is successfully saved in the **UPLOAD_FOLDER**, we called **process_file** function and passed the uploaded file path as an argument.

For this task i.e removing watermark from the pdf file. First we should be able to read pdf file, for that we would use [PyPDF2](https://pythonhosted.org/PyPDF2/) module. I simply reduced the height of the page which cuts the watermark from the image. Once height of image is reduced I add the modified pdf page to another pdf which I would expose to user for download. In the function below **remove_watermark** I am saving the modified/processed pdf in **DOWNLOAD_FOLDER** directory.

```python
from PyPDF2 import PdfFileReader, PdfFileWriter

DOWNLOAD_FOLDER = os.path.dirname(os.path.abspath(__file__)) + '/downloads/'

app.config['DOWNLOAD_FOLDER'] = DOWNLOAD_FOLDER

def process_file(path, filename):
   remove_watermark(path, filename)

def remove_watermark(path, filename):
   input_file = PdfFileReader(open(path, 'rb'))
   output = PdfFileWriter()
   for page_number in range(input_file.getNumPages()):
       page = input_file.getPage(page_number)
       page.mediaBox.lowerLeft = (page.mediaBox.getLowerLeft_x(), 20)
       output.addPage(page)
   output_stream = open(app.config['DOWNLOAD_FOLDER'] + filename, 'wb')
   output.write(output_stream)
```
### Allow Users to Download Processed File
Once the uploaded file is processed, we send it to user i.e the processed file is downloaded in the client’s browser.

**send_from_directory:** This function sends a file from a given directory. This is a secure way to quickly expose static files from an upload folder or something similar.

```python
@app.route('/uploads/<filename>')
def uploaded_file(filename):
   return send_from_directory(app.config['DOWNLOAD_FOLDER'], filename, as_attachment=True)
```

**as_attachment = True** downloads the file as sometimes it might happen that pdf is opened in the browser itself and you have to save it manually. **as_attachement = True** makes sure that the file is downloaded instead of opening in the browser.

According to Flask API documentation - set to **True** if you want to send this file with a **Content-Disposition: attachment** header.
If you haven’t explicitly set a limit to size on file that can be uploaded, Flask would upload file of any size which is generally not that case. Your site would have a limit on file size to process. In our case let's say we will process pdf file less than or equal to 8mb. We set the limit on **MAX_CONTENT_LENGTH** config key.
```python
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
```
Now the Flask app is complete with all the required functionalities i.e it allows users to upload a pdf file, removes watermark from it, saves it in download folder and sends modified file to user’s browser as downloaded file.

Source Code : [https://github.com/viveksb007/camscanner_watermark_remover](https://github.com/viveksb007/camscanner_watermark_remover)

{% include youtubeplayer.html id=page.youtubeId %}
