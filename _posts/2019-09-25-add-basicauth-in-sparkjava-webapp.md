---
layout: post
title: "Add BasicAuth in SparkJava Webapp"
date: 2019-09-25
tags: [kotlin, sparkjava, basic-auth]
comments: true
---

In this post, I am going to show you how to add Basic Authentication to your SparkJava webapp in Kotlin.

### **Spark Java** : 
Its a micro-framework for creating web applications in Kotlin and Java 8 with minimal effort.

### **Basic Authentication** : 
Its simply an **Authorization** header whose value is ```Basic base64encode(usename:password)```
So if username and password is **admin** and **admin**. Base64 encoding of **admin:admin** is **YWRtaW46YWRtaW4=**  
Value of header will be 
> **Authorization : Basic YWRtaW46YWRtaW4=**

SparkJava allows us to add _**before**_ and _**after**_ filters which are evaluated before and after each request.

I will be writing a **_BasicAuthFilter_** which takes in a **username** and **password** with which you want to protect your webapp. Simply add a **_before_** filter which takes in **_BasicAuthFilter_** instance.

```kotlin
before(BasicAuthFilter("admin", "admin"))
```

```kotlin
class BasicAuthFilter(private val username: String, private val password: String) : Filter {

    override fun handle(request: Request, response: Response) {
        if (!request.headers().contains("Authorization") || !authenticated(request)) {
            response.header("WWW-Authenticate", BASIC_AUTHENTICATION_TYPE)
            halt(401, "Not Authenticate")
        }
    }

    private fun authenticated(request: Request): Boolean {
        val encodedHeader = request.headers("Authorization").substringAfter("Basic").trim()
        val submittedCredentials = extractCredentials(encodedHeader)
        if (submittedCredentials != null && submittedCredentials.size == NUMBER_OF_AUTHENTICATION_FIELDS) {
            val submittedUsername = submittedCredentials[0]
            val submittedPassword = submittedCredentials[1]
            return username == submittedUsername && password == submittedPassword
        }
        return false
    }

    private fun extractCredentials(encodedHeader: String?): Array<String>? {
        return if (encodedHeader != null) {
            val decodedHeader = String(Base64.getDecoder().decode(encodedHeader))
            decodedHeader.split(":").toTypedArray()
        } else {
            null
        }
    }

    companion object {
        private const val BASIC_AUTHENTICATION_TYPE = "Basic"
        private const val NUMBER_OF_AUTHENTICATION_FIELDS = 2
    }

}
```

**_handle()_** method contains logic for extracting encoded header and decoding the header into username and password. Extracted username and password is checked with the main credentials that you supplied while creating the instance of **_BasicAuthFilter_**. If submitted username and password is incorrect request is halted using **_halt(401)_** else request is passed down for further processing.

## References:  
1. [http://sparkjava.com/documentation](http://sparkjava.com/documentation)  
2. [https://en.wikipedia.org/wiki/Basic\_access\_authentication](https://en.wikipedia.org/wiki/Basic_access_authentication)  
3. [https://github.com/qmetric/spark-authentication](https://github.com/qmetric/spark-authentication)
