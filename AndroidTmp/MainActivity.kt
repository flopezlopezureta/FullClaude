package com.fullenvios.myapplication

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var mFilePathCallback: ValueCallback<Array<Uri>>? = null
    private val FILECHOOSER_RESULTCODE = 1
    private val PERMISSION_REQUEST_CODE = 1234

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // SOLUCIÓN DEFINITIVA: Solicitar permisos a la fuerza al abrir la App (Android 6.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val permissions = arrayOf(
                android.Manifest.permission.CAMERA,
                android.Manifest.permission.READ_EXTERNAL_STORAGE,
                android.Manifest.permission.WRITE_EXTERNAL_STORAGE,
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
            val missingPermissions = permissions.filter {
                checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
            }
            if (missingPermissions.isNotEmpty()) {
                requestPermissions(missingPermissions.toTypedArray(), PERMISSION_REQUEST_CODE)
            }
        }

        webView = WebView(this)
        setContentView(webView)

        // PANTALLA COMPLETA
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN)

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.databaseEnabled = true
        settings.javaScriptCanOpenWindowsAutomatically = true

        // Interface para exportar a Circuit
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidApp")

        // Permite abrir funciones de geolocalización en la WebView
        settings.setGeolocationEnabled(true)

        // Bloquea el botón gigante de Play
        settings.mediaPlaybackRequiresUserGesture = false
        // Permite abrir contenido seguro desde red
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

        webView.webChromeClient = object : WebChromeClient() {
            
            // ELIMINAR EL PANTALLAZO DEL BOTÓN PLAY GIGANTE
            override fun getDefaultVideoPoster(): Bitmap? {
                val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
                bitmap.eraseColor(Color.TRANSPARENT)
                return bitmap
            }

            // Otorga permiso a GPS nativo al navegador web automáticamente
            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }

            // Otorga permiso a la cámara en el navegador web
            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (mFilePathCallback != null) {
                    mFilePathCallback?.onReceiveValue(null)
                }
                mFilePathCallback = filePathCallback

                val intent = fileChooserParams?.createIntent()
                try {
                    startActivityForResult(intent!!, FILECHOOSER_RESULTCODE)
                } catch (e: ActivityNotFoundException) {
                    mFilePathCallback = null
                    return false
                }
                return true
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }
        }

        webView.loadUrl("https://fullenvios.selcom.cl")
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (mFilePathCallback == null) return
            mFilePathCallback!!.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            mFilePathCallback = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}

class WebAppInterface(private val mContext: android.content.Context) {
    @JavascriptInterface
    fun shareText(text: String, title: String) {
        val sendIntent: android.content.Intent = android.content.Intent().apply {
            action = android.content.Intent.ACTION_SEND
            putExtra(android.content.Intent.EXTRA_TEXT, text)
            type = "text/plain"
        }
        val shareIntent = android.content.Intent.createChooser(sendIntent, title)
        shareIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        mContext.startActivity(shareIntent)
    }

    @JavascriptInterface
    fun downloadFile(content: String, fileName: String) {
        try {
            // Usamos externalCacheDir para asegurar que otras carpetas puedan leerlo con el permiso de GrantUri
            val file = java.io.File(mContext.externalCacheDir, fileName)
            file.writeText(content)
            
            val uri = androidx.core.content.FileProvider.getUriForFile(
                mContext,
                "com.fullenvios.myapplication.provider",
                file
            )
            
            // Intent dual: Intentar con ACTION_VIEW (abrir) o ACTION_SEND (compartir) 
            // ACTION_VIEW es ideal para "Abrir con..." lo que solicita el usuario (Importar)
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "text/csv")
                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            
            // Si el dispositivo tiene una App para esto, lanzará el chooser automáticamente
            val chooser = android.content.Intent.createChooser(intent, "Importar en Circuit")
            chooser.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            mContext.startActivity(chooser)
        } catch (e: Exception) {
            e.printStackTrace()
            // Mensaje de depuración en LogCat por si falla
            android.util.Log.e("WebViewBridge", "Error al descargar/abrir archivo: ${e.message}")
        }
    }
}
