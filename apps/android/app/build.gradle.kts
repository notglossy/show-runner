plugins {
    alias(libs.plugins.android.application)
}

// Release signing comes from ~/.gradle/gradle.properties (or environment variables), never the repo:
//   SHOWRUNNER_KEYSTORE, SHOWRUNNER_KEY_ALIAS, SHOWRUNNER_KEYSTORE_PASSWORD, optional SHOWRUNNER_KEY_PASSWORD.
fun signingValue(name: String): String? =
    providers.gradleProperty(name).orElse(providers.environmentVariable(name)).orNull?.trim()?.takeIf { it.isNotEmpty() }

val releaseKeystore = signingValue("SHOWRUNNER_KEYSTORE")
val releaseKeyAlias = signingValue("SHOWRUNNER_KEY_ALIAS")
val releaseStorePassword = signingValue("SHOWRUNNER_KEYSTORE_PASSWORD")
// PKCS12 keystores (keytool's default) use the keystore password for the key too.
val releaseKeyPassword = signingValue("SHOWRUNNER_KEY_PASSWORD") ?: releaseStorePassword
val releaseSigningConfigured = releaseKeystore != null && releaseKeyAlias != null && releaseStorePassword != null

// Every build of a newer commit gets a higher versionCode, which Android requires for updates.
val gitCommitCount: Int = providers.exec {
    commandLine("git", "rev-list", "--count", "HEAD")
    isIgnoreExitValue = true
}.standardOutput.asText.get().trim().toIntOrNull() ?: 1

android {
    namespace = "com.notglossy.showrunner"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.notglossy.showrunner"
        minSdk = 30
        targetSdk = 36
        versionCode = gitCommitCount
        versionName = "0.2.0"

    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = file(releaseKeystore!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (releaseSigningConfigured) signingConfigs.getByName("release") else null
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

    testImplementation(libs.junit)
    testImplementation(libs.org.json)
}

// Fail loudly (at configuration time, configuration-cache safe) instead of producing an unsigned release APK.
if (!releaseSigningConfigured && gradle.startParameter.taskNames.any { it.contains("Release", ignoreCase = true) }) {
    throw GradleException(
        "Release signing isn't configured. Set SHOWRUNNER_KEYSTORE, SHOWRUNNER_KEY_ALIAS and " +
            "SHOWRUNNER_KEYSTORE_PASSWORD in ~/.gradle/gradle.properties (see docs/device-setup.md).",
    )
}
