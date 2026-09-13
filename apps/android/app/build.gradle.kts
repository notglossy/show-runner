plugins {
    alias(libs.plugins.android.application)
}

// Build with -PshowrunnerLauncher=true to let the app act as the device's Home screen.
val launcherEnabled = (findProperty("showrunnerLauncher") as String?)?.toBoolean() ?: false

android {
    namespace = "com.notglossy.showrunner"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.notglossy.showrunner"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"

        manifestPlaceholders["launcherEnabled"] = launcherEnabled.toString()
        buildConfigField("boolean", "LAUNCHER_ENABLED", launcherEnabled.toString())
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
