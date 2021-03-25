---
layout: post
title: "Annotations in Java"
date: 2021-03-26
tags: [Java]
comments: true
---

Annotations are one of those features of Java whose working is not much clear to the developers. This post is for self reference for annotations in java.

Some example of annotations below - 

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
public @interface FunctionalInterface {
}
```

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.SOURCE)
public @interface Override {
}
```

Any annotation has a retention policy attached to it. There are 3 types of **"Retention Policy"**

- **SOURCE** -> These annotations are in source code only. When the ***“.java”*** file is compiled to ***“.class”*** these annotations are gone.

- **CLASS** -> These annotations are retained in ***“.class”*** files. So if you decompile the class, you can see the annotations. These annotations are discarded when the class is loaded into the JVM.

- **RUNTIME** -> These annotations are available in the runtime also. They are available in runtime via reflection.

There is also a “**Target**” attached to the annotation which basically tells on what “**ElementType**” that annotation can be used. Some example of ElementType is -

-   **FIELD**  
```java      
@NonNull  
private String name;  
```
      
    
-   **METHOD**  
```java
@Singleton  
private String getString() { 
    return "yoman"; 
}  
```
    
-   **PARAMETER**  
```java
private String getString(@NonNull String temp) {
    return temp; 
}
```

For annotations with “**SOURCE**” retention type, there is an annotation processor hooked in between the compilation cycle, which injects some code or does some checks during compilation itself. Typically an annotation processor is plugged into your binary/jar build lifecycle. For example if you are using the Gradle build system, you specify the annotation processor in dependencies which is invoked while building the artifact using your code.

  

Annotations with “**RUNTIME**” retention policy can be accessed using Reflection. There is a great post by [baeldung](https://www.baeldung.com/java-custom-annotation) with an example showing how to create annotations and access it in runtime.  
 
## References

-   [https://stackoverflow.com/questions/3107970/how-do-different-retention-policies-affect-my-annotations](https://stackoverflow.com/questions/3107970/how-do-different-retention-policies-affect-my-annotations)
    
-   [https://www.baeldung.com/java-custom-annotation](https://www.baeldung.com/java-custom-annotation)