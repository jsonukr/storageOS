# kotlinx.serialization
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt

-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.storageos.android.**$$serializer { *; }
-keepclassmembers class com.storageos.android.** {
    *** Companion;
}
-keepclasseswithmembers class com.storageos.android.** {
    kotlinx.serialization.KSerializer serializer(...);
}
