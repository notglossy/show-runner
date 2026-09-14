plugins {
    alias(libs.plugins.android.application)
}

android {
    namespace = "com.notglossy.showrunner"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.notglossy.showrunner"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.webkit)
}
