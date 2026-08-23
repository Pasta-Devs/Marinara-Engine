package com.marinara.engine;

import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final String SERVER_URL = BuildConfig.MARINARA_SERVER_URL;
    private static final int RETRY_DELAY_MS = 2000;
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int TERMUX_PERMISSION_REQUEST = 1002;
    private static final int UNKNOWN_APP_SOURCES_REQUEST = 1003;
    private static final int TERMUX_INSTALL_STATUS_REQUEST = 1004;
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1005;
    private static final int FILE_SAVE_REQUEST = 1006;
    private static final String DISPLAY_PREFS = "marinara_display";
    private static final String STATUS_BAR_VISIBLE = "status_bar_visible";
    private static final String NOTIFICATION_PERMISSION_PREFS = "marinara_notification_permission";
    private static final String NOTIFICATION_PERMISSION_REQUESTED = "requested";
    private static final String MESSAGE_NOTIFICATION_CHANNEL_ID = "marinara_messages";
    private static final String TERMUX_PACKAGE = "com.termux";
    private static final String TERMUX_RUN_COMMAND_PERMISSION = "com.termux.permission.RUN_COMMAND";
    private static final String TERMUX_DOWNLOAD_PAGE = "https://f-droid.org/en/packages/com.termux/";
    private static final String TERMUX_APK_DOWNLOAD_URL = "https://f-droid.org/repo/com.termux_1002.apk";
    private static final long TERMUX_APK_SIZE = 113_880_067L;
    private static final long TERMUX_APK_VERSION_CODE = 1002L;
    private static final String TERMUX_APK_SHA256 =
            "e6265a57eb5ca363808488e3b01955958bed93bc0c8a0d281849b363b11027ec";
    private static final String TERMUX_SIGNER_SHA256 =
            "228fb2cfe90831c1499ec3ccaf61e96e8e1ce70766b9474672ce427334d41c42";
    private static final String TERMUX_PLAY_STORE_SIGNER_SHA256 =
            "738f0a30a04d3c8a1be304af18d0779bcf3ea88fb60808f657a3521861c2ebf9";
    private static final String TERMUX_DEVS_SIGNER_SHA256 =
            "f7a038eb551f1be8fdf388686b784abab4552a5d82df423e3d8f1b5cbe1c69ae";
    // Termux's GitHub APKs use a publicly shared test key, so they require the
    // same explicit one-session confirmation as any other unverified build.
    private static final String TERMUX_INSTALL_STATUS_ACTION = "com.marinara.engine.TERMUX_INSTALL_STATUS";
    private static final String SECURITY_PREFS = "marinara_security";
    private static final String ANDROID_SECRET_PREF = "android_local_secret";
    private static final String INSTALL_SESSION_PREF = "termux_install_session";
    private static final String INSTALL_NONCE_PREF = "termux_install_nonce";
    private static final String TERMUX_HOME = "/data/data/com.termux/files/home";
    private static final String TERMUX_BASH = "/data/data/com.termux/files/usr/bin/bash";
    private static final String TERMUX_EXTERNAL_APPS_COMMAND =
            "mkdir -p ~/.termux; "
                    + "grep -qxF 'allow-external-apps=true' ~/.termux/termux.properties 2>/dev/null || echo 'allow-external-apps=true' >> ~/.termux/termux.properties; "
                    + "if command -v termux-reload-settings >/dev/null 2>&1; then termux-reload-settings; else echo 'allow-external-apps=true saved. Fully close and reopen Termux if Marinara still cannot start it.'; fi";

    private WebView webView;
    private View splashView;
    private ProgressBar spinner;
    private TextView statusText;
    private Button manualServerButton;
    private ValueCallback<Uri[]> fileUploadCallback;
    private byte[] pendingFileSaveData;
    private String pendingFileSaveName;
    private boolean isDownloadingTermux;
    private boolean pendingStartAfterTermuxInstall;
    private boolean isCheckingServer;
    private boolean mainFrameLoadFailed;
    private boolean connectionRetryPaused;
    private volatile boolean bridgeEnabled;
    private volatile String bridgeToken;
    private String approvedUnverifiedTermuxSigner;
    private String currentMainFrameUrl;
    private long currentMainFrameNavigationId;
    private long activeServerMainFrameNavigationId;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable retryConnectionRunnable = this::tryConnect;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        applyStatusBarVisibility(isStatusBarVisible());

        // Root layout
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFF0A0A0F);

        // WebView (hidden initially)
        webView = new WebView(this);
        webView.setVisibility(View.INVISIBLE);
        webView.setBackgroundColor(0xFF0A0A0F);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        // Splash screen overlay
        splashView = buildSplashView();
        root.addView(splashView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        createMessageNotificationChannel();
        configureWebView();
        tryConnect();
        handleTermuxInstallStatus(getIntent());
    }

    private View buildSplashView() {
        FrameLayout splash = new FrameLayout(this);
        splash.setBackgroundColor(0xFF0A0A0F);

        // Vertical center container
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.VERTICAL);
        container.setGravity(android.view.Gravity.CENTER);
        container.setPadding(48, 0, 48, 0);

        // Status text
        statusText = new TextView(this);
        statusText.setText("Marinara Engine Android shell\nTap Install / Start Marinara to begin.");
        statusText.setTextColor(0xFFCCCCCC);
        statusText.setTextSize(16f);
        statusText.setGravity(android.view.Gravity.CENTER);
        statusText.setPadding(32, 0, 32, 24);
        container.addView(statusText);

        // Spinner
        spinner = new ProgressBar(this);
        spinner.setIndeterminate(true);
        container.addView(spinner);

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.VERTICAL);
        actions.setPadding(0, 28, 0, 0);

        Button setupButton = buildActionButton("Install / Start Marinara");
        setupButton.setOnClickListener(v -> startTermuxSetup());
        actions.addView(setupButton, buildActionButtonLayoutParams());

        Button termuxButton = buildActionButton("Get Termux manually");
        termuxButton.setOnClickListener(v -> openTermuxDownload());
        actions.addView(termuxButton, buildActionButtonLayoutParams());

        Button retryButton = buildActionButton("Retry connection");
        retryButton.setOnClickListener(v -> {
            resumeConnectionRetryLoop();
            tryConnect();
        });
        actions.addView(retryButton, buildActionButtonLayoutParams());

        manualServerButton = buildActionButton("Open manual server");
        manualServerButton.setVisibility(View.GONE);
        manualServerButton.setOnClickListener(v -> confirmManualServerAccess());
        actions.addView(manualServerButton, buildActionButtonLayoutParams());

        container.addView(actions);

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = android.view.Gravity.CENTER;
        splash.addView(container, lp);
        return splash;
    }

    private Button buildActionButton(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextColor(0xFFFFFFFF);
        button.setBackgroundColor(0xFF3A2A46);
        button.setPadding(28, 12, 28, 12);
        return button;
    }

    private LinearLayout.LayoutParams buildActionButtonLayoutParams() {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        params.setMargins(0, 0, 0, 12);
        return params;
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        // Android's system picker returns content:// URIs to <input type="file">.
        // Keep direct file:// access disabled, but allow the WebView to read
        // picker-granted content URIs for uploads such as chat backgrounds.
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " MarinaraEngine/Android");

        webView.addJavascriptInterface(new MarinaraAndroidBridge(), "MarinaraAndroidNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // Keep only the exact configured Marinara origin inside the WebView.
                if (isServerUrl(url)) {
                    return false;
                }
                // Open external links in the default browser
                Intent intent = new Intent(Intent.ACTION_VIEW, request.getUrl());
                startActivity(intent);
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                bridgeEnabled = false;
                bridgeToken = null;
                currentMainFrameUrl = url;
                currentMainFrameNavigationId++;
                if (isServerUrl(url)) {
                    activeServerMainFrameNavigationId = currentMainFrameNavigationId;
                    mainFrameLoadFailed = false;
                } else {
                    activeServerMainFrameNavigationId = 0;
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (isActiveServerMainFrame(url) && isDisplayableServerUrl(url) && !mainFrameLoadFailed) {
                    enableBridgeForNavigation(view, url);
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (isActiveServerMainFrame(failingUrl)) {
                    handleServerLoadFailure();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                String failingUrl = request.getUrl().toString();
                if (request.isForMainFrame() && isActiveServerMainFrame(failingUrl)) {
                    handleServerLoadFailure();
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                String failingUrl = request.getUrl().toString();
                if (request.isForMainFrame() && isActiveServerMainFrame(failingUrl)) {
                    handleServerLoadFailure();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = callback;
                Intent intent = params.createIntent();
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    return false;
                }
                return true;
            }
        });
    }

    private void tryConnect() {
        if (isCheckingServer) return;
        cancelPendingConnectionRetry();
        showBootstrap("Connecting to Marinara Engine…\nIf this is your first launch, tap Install / Start Marinara.", true);

        isCheckingServer = true;
        new Thread(() -> {
            AndroidSessionAttempt attempt = prepareAndroidSession();
            runOnUiThread(() -> {
                isCheckingServer = false;
                if (connectionRetryPaused) return;
                if (attempt.session != null) {
                    mainFrameLoadFailed = false;
                    statusText.setText("Opening Marinara Engine…");
                    webView.postUrl(
                            SERVER_URL + "/api/android-auth/session",
                            attempt.session.formBody().getBytes(StandardCharsets.UTF_8)
                    );
                } else if (attempt.manualServerDetected) {
                    showManualServerOption();
                } else {
                    retryConnection();
                }
            });
        }).start();
    }

    private void retryConnection() {
        showBootstrap("Waiting for Marinara Engine…\nTap Install / Start Marinara if the local server is not running yet.", true);
        scheduleConnectionRetry();
    }

    private void showWebView() {
        cancelPendingConnectionRetry();
        splashView.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void showBootstrap(String message, boolean showSpinner) {
        bridgeEnabled = false;
        bridgeToken = null;
        statusText.setText(message);
        spinner.setVisibility(showSpinner ? View.VISIBLE : View.GONE);
        if (manualServerButton != null) manualServerButton.setVisibility(View.GONE);
        splashView.setVisibility(View.VISIBLE);
        webView.setVisibility(View.INVISIBLE);
    }

    private void showManualServerOption() {
        pauseConnectionRetryLoop();
        showBootstrap(
                "A manually installed Marinara server is running, but it does not support APK authentication.\n"
                        + "You can still open it after confirming that you started this server in Termux.",
                false
        );
        manualServerButton.setVisibility(View.VISIBLE);
    }

    private void confirmManualServerAccess() {
        new AlertDialog.Builder(this)
                .setTitle("Open manual Marinara server?")
                .setMessage(
                        "The Android app cannot verify this server's identity. Continue only if you started "
                                + "Marinara in Termux yourself. This keeps manual installations available."
                )
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open server", (dialog, which) -> {
                    resumeConnectionRetryLoop();
                    mainFrameLoadFailed = false;
                    showBootstrap("Opening the confirmed manual server…", true);
                    webView.loadUrl(SERVER_URL);
                })
                .show();
    }

    private void handleServerLoadFailure() {
        mainFrameLoadFailed = true;
        webView.stopLoading();
        if (connectionRetryPaused) return;
        retryConnection();
    }

    private void scheduleConnectionRetry() {
        if (connectionRetryPaused) return;
        cancelPendingConnectionRetry();
        handler.postDelayed(retryConnectionRunnable, RETRY_DELAY_MS);
    }

    private void cancelPendingConnectionRetry() {
        handler.removeCallbacks(retryConnectionRunnable);
    }

    private void pauseConnectionRetryLoop() {
        connectionRetryPaused = true;
        cancelPendingConnectionRetry();
    }

    private void resumeConnectionRetryLoop() {
        connectionRetryPaused = false;
    }

    private AndroidSessionAttempt prepareAndroidSession() {
        HttpURLConnection connection = null;
        try {
            String secret = getOrCreateAndroidSecret();
            String clientNonce = randomHex(32);
            byte[] requestBody = new JSONObject().put("clientNonce", clientNonce)
                    .toString()
                    .getBytes(StandardCharsets.UTF_8);
            connection = (HttpURLConnection) new URL(SERVER_URL + "/api/android-auth/challenge").openConnection();
            connection.setConnectTimeout(1_000);
            connection.setReadTimeout(1_500);
            connection.setInstanceFollowRedirects(false);
            connection.setUseCaches(false);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("User-Agent", "MarinaraEngine/Android");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setFixedLengthStreamingMode(requestBody.length);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(requestBody);
            }
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_NOT_FOUND) return AndroidSessionAttempt.manualServer();
            if (status != HttpURLConnection.HTTP_OK) return AndroidSessionAttempt.unavailable();

            JSONObject response = new JSONObject(readSmallResponse(connection));
            String serverNonce = response.getString("serverNonce").toLowerCase();
            String proof = response.getString("proof").toLowerCase();
            if (!isHex256(serverNonce)) return AndroidSessionAttempt.unavailable();
            String expectedProof = hmacHex(secret, "server:" + clientNonce + ":" + serverNonce);
            if (!constantTimeEquals(proof, expectedProof)) return AndroidSessionAttempt.unavailable();
            String clientProof = hmacHex(secret, "client:" + clientNonce + ":" + serverNonce);
            return AndroidSessionAttempt.authenticated(
                    new AndroidSessionBootstrap(clientNonce, serverNonce, clientProof)
            );
        } catch (Exception e) {
            return AndroidSessionAttempt.unavailable();
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private boolean isServerUrl(String url) {
        if (url == null) return false;
        try {
            Uri serverUri = Uri.parse(SERVER_URL);
            Uri candidateUri = Uri.parse(url);
            return textEquals(serverUri.getScheme(), candidateUri.getScheme())
                    && textEquals(serverUri.getHost(), candidateUri.getHost())
                    && serverUri.getPort() == candidateUri.getPort();
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isActiveServerMainFrame(String url) {
        return activeServerMainFrameNavigationId == currentMainFrameNavigationId
                && textEquals(currentMainFrameUrl, url)
                && isServerUrl(url);
    }

    private boolean isDisplayableServerUrl(String url) {
        if (!isServerUrl(url)) return false;
        String path = Uri.parse(url).getPath();
        return path == null
                || (!path.startsWith("/api/android-auth") && !"/android-login".equals(path));
    }

    private void enableBridgeForNavigation(WebView view, String url) {
        if (bridgeToken != null) return;
        final long navigationId = currentMainFrameNavigationId;
        final String token = randomHex(32);
        bridgeToken = token;
        String script = "(() => {"
                + "if (window !== window.top) return false;"
                + "const nativeBridge = window.MarinaraAndroidNative;"
                + "if (!nativeBridge) return false;"
                + "Object.defineProperty(window, '__MARINARA_ANDROID_BRIDGE_TOKEN__', {"
                + "value: '" + token + "', configurable: false, enumerable: false, writable: false"
                + "});"
                + "const withoutToken = (values) => values[0] === '" + token + "' ? values.slice(1) : values;"
                + "const bridge = Object.freeze({"
                + "isStatusBarVisible: () => nativeBridge.isStatusBarVisible('" + token + "'),"
                + "setStatusBarVisible: (...values) => nativeBridge.setStatusBarVisible('" + token + "', Boolean(withoutToken(values)[0])),"
                + "getNotificationPermission: () => nativeBridge.getNotificationPermission('" + token + "'),"
                + "requestNotificationPermission: () => nativeBridge.requestNotificationPermission('" + token + "'),"
                + "showNotification: (...values) => nativeBridge.showNotification('" + token + "', ...withoutToken(values)),"
                + "saveFile: (...values) => nativeBridge.saveFile('" + token + "', ...withoutToken(values)),"
                + "openConsole: () => nativeBridge.openConsole('" + token + "')"
                + "});"
                + "Object.defineProperty(window, 'MarinaraAndroid', {"
                + "value: bridge, configurable: false, enumerable: false, writable: false"
                + "});"
                + "return true;"
                + "})()";
        view.evaluateJavascript(script, result -> {
            if (navigationId != currentMainFrameNavigationId
                    || !isActiveServerMainFrame(url)
                    || !constantTimeEquals(token, bridgeToken)) {
                return;
            }
            if (!"true".equals(result)) {
                bridgeEnabled = false;
                bridgeToken = null;
                handleServerLoadFailure();
                return;
            }
            bridgeEnabled = true;
            view.evaluateJavascript(
                    "window.dispatchEvent(new Event('marinara:android-bridge-ready'))",
                    null
            );
            showWebView();
        });
    }

    private boolean isTrustedBridgeCaller(String token) {
        return bridgeEnabled && constantTimeEquals(bridgeToken, token);
    }

    private boolean textEquals(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private synchronized String getOrCreateAndroidSecret() {
        String existing = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                .getString(ANDROID_SECRET_PREF, null);
        if (isHex256(existing)) return existing.toLowerCase();

        String created = randomHex(32);
        boolean saved = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                .edit()
                .putString(ANDROID_SECRET_PREF, created)
                .commit();
        if (!saved) throw new IllegalStateException("Could not store Android local secret");
        return created;
    }

    private String randomHex(int byteCount) {
        byte[] value = new byte[byteCount];
        new SecureRandom().nextBytes(value);
        return hex(value);
    }

    private String hmacHex(String secretHex, String value) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(hexBytes(secretHex), "HmacSHA256"));
        return hex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private boolean constantTimeEquals(String left, String right) {
        if (left == null || right == null) return false;
        return MessageDigest.isEqual(
                left.getBytes(StandardCharsets.US_ASCII),
                right.getBytes(StandardCharsets.US_ASCII)
        );
    }

    private boolean isHex256(String value) {
        return value != null && value.matches("^[a-fA-F0-9]{64}$");
    }

    private byte[] hexBytes(String value) {
        if (value == null || (value.length() & 1) != 0) {
            throw new IllegalArgumentException("Invalid hexadecimal value");
        }
        byte[] result = new byte[value.length() / 2];
        for (int i = 0; i < result.length; i++) {
            int high = Character.digit(value.charAt(i * 2), 16);
            int low = Character.digit(value.charAt(i * 2 + 1), 16);
            if (high < 0 || low < 0) throw new IllegalArgumentException("Invalid hexadecimal value");
            result[i] = (byte) ((high << 4) | low);
        }
        return result;
    }

    private String hex(byte[] value) {
        StringBuilder result = new StringBuilder(value.length * 2);
        for (byte entry : value) result.append(String.format("%02x", entry & 0xff));
        return result.toString();
    }

    private String readSmallResponse(HttpURLConnection connection) throws Exception {
        try (InputStream input = connection.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > 16 * 1024) throw new IllegalStateException("Authentication response is too large");
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static class AndroidSessionBootstrap {
        private final String clientNonce;
        private final String serverNonce;
        private final String proof;

        AndroidSessionBootstrap(String clientNonce, String serverNonce, String proof) {
            this.clientNonce = clientNonce;
            this.serverNonce = serverNonce;
            this.proof = proof;
        }

        String formBody() {
            try {
                return "clientNonce=" + URLEncoder.encode(clientNonce, StandardCharsets.UTF_8.name())
                        + "&serverNonce=" + URLEncoder.encode(serverNonce, StandardCharsets.UTF_8.name())
                        + "&proof=" + URLEncoder.encode(proof, StandardCharsets.UTF_8.name());
            } catch (Exception error) {
                throw new IllegalStateException("UTF-8 is unavailable", error);
            }
        }
    }

    private static class AndroidSessionAttempt {
        private final AndroidSessionBootstrap session;
        private final boolean manualServerDetected;

        private AndroidSessionAttempt(AndroidSessionBootstrap session, boolean manualServerDetected) {
            this.session = session;
            this.manualServerDetected = manualServerDetected;
        }

        static AndroidSessionAttempt authenticated(AndroidSessionBootstrap session) {
            return new AndroidSessionAttempt(session, false);
        }

        static AndroidSessionAttempt manualServer() {
            return new AndroidSessionAttempt(null, true);
        }

        static AndroidSessionAttempt unavailable() {
            return new AndroidSessionAttempt(null, false);
        }
    }

    private void startTermuxSetup() {
        pauseConnectionRetryLoop();
        if (!isTermuxInstalled()) {
            startTermuxInstallFlow();
            return;
        }

        String signer = installedTermuxSignerSha256();
        if (!isTrustedTermuxSigner(signer) && !textEquals(approvedUnverifiedTermuxSigner, signerLabel(signer))) {
            confirmUnverifiedTermux(signer);
            return;
        }

        if (!hasTermuxRunCommandPermission()) {
            showBootstrap("Android needs one permission so Marinara can start Termux for you.\nApprove Run commands in Termux environment.", false);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                requestPermissions(new String[]{TERMUX_RUN_COMMAND_PERMISSION}, TERMUX_PERMISSION_REQUEST);
            }
            return;
        }

        sendTermuxSetupCommand();
    }

    private void startTermuxInstallFlow() {
        pendingStartAfterTermuxInstall = true;
        pauseConnectionRetryLoop();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            showBootstrap("Android needs permission to let Marinara install Termux.\nEnable Allow from this source, then return here.", false);
            try {
                Intent intent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName())
                );
                startActivityForResult(intent, UNKNOWN_APP_SOURCES_REQUEST);
            } catch (ActivityNotFoundException e) {
                showBootstrap("Android blocked the built-in Termux installer.\nUse Get Termux manually, then return here.", false);
                openTermuxDownload();
            }
            return;
        }

        downloadAndInstallTermux();
    }

    private void downloadAndInstallTermux() {
        if (isDownloadingTermux) return;
        pauseConnectionRetryLoop();
        isDownloadingTermux = true;
        showBootstrap("Downloading Termux from F-Droid…\nAndroid will ask you before installing it.", true);

        new Thread(() -> {
            try {
                File apk = downloadTermuxApk();
                runOnUiThread(() -> {
                    isDownloadingTermux = false;
                    launchTermuxPackageInstall(apk);
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    isDownloadingTermux = false;
                    showBootstrap("Could not download Termux automatically.\nOpening the F-Droid page instead.", false);
                    openTermuxDownload();
                });
            }
        }).start();
    }

    private File downloadTermuxApk() throws Exception {
        File target = new File(getCacheDir(), "termux-fdroid.apk");
        File temp = new File(getCacheDir(), "termux-fdroid.apk.download");
        if (target.exists() && verifyTermuxApk(target)) return target;
        if (target.exists()) target.delete();
        if (temp.exists()) temp.delete();

        HttpURLConnection connection = (HttpURLConnection) new URL(TERMUX_APK_DOWNLOAD_URL).openConnection();
        connection.setConnectTimeout(20_000);
        connection.setReadTimeout(60_000);
        connection.setRequestProperty("User-Agent", "MarinaraEngine/Android");

        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("Termux APK download failed with HTTP " + status);
        }

        int contentLength = connection.getContentLength();
        if (contentLength > 0 && contentLength != TERMUX_APK_SIZE) {
            connection.disconnect();
            throw new IllegalStateException("F-Droid returned an unexpected Termux APK size");
        }
        try (InputStream in = connection.getInputStream();
             OutputStream out = new FileOutputStream(temp)) {
            byte[] buffer = new byte[64 * 1024];
            long copied = 0;
            int read;
            int lastProgress = -1;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                copied += read;
                if (copied > TERMUX_APK_SIZE) {
                    throw new IllegalStateException("Termux APK download exceeded its expected size");
                }
                if (contentLength > 0) {
                    int progress = (int) Math.min(99, (copied * 100) / contentLength);
                    if (progress >= lastProgress + 10) {
                        lastProgress = progress;
                        int displayProgress = progress;
                        runOnUiThread(() -> statusText.setText(
                                "Downloading Termux from F-Droid… " + displayProgress + "%\nAndroid will ask you before installing it."
                        ));
                    }
                }
            }
        } finally {
            connection.disconnect();
        }

        if (target.exists()) target.delete();
        if (!temp.renameTo(target)) {
            throw new IllegalStateException("Could not prepare downloaded Termux APK");
        }
        if (!verifyTermuxApk(target)) {
            target.delete();
            throw new IllegalStateException("Downloaded Termux APK failed integrity verification");
        }
        return target;
    }

    private boolean verifyTermuxApk(File apkFile) {
        try {
            if (!apkFile.isFile() || apkFile.length() != TERMUX_APK_SIZE) return false;
            if (!TERMUX_APK_SHA256.equals(sha256(apkFile))) return false;

            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? PackageManager.GET_SIGNING_CERTIFICATES
                    : PackageManager.GET_SIGNATURES;
            PackageInfo info = getPackageManager().getPackageArchiveInfo(apkFile.getAbsolutePath(), flags);
            if (info == null || !TERMUX_PACKAGE.equals(info.packageName)) return false;
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;
            if (versionCode != TERMUX_APK_VERSION_CODE) return false;

            Signature[] signatures = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signatures;
            if (signatures == null || signatures.length != 1) return false;
            return TERMUX_SIGNER_SHA256.equals(hex(
                    MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray())
            ));
        } catch (Exception error) {
            return false;
        }
    }

    private String sha256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        return hex(digest.digest());
    }

    private void launchTermuxPackageInstall(File apkFile) {
        try {
            if (!verifyTermuxApk(apkFile)) {
                throw new IllegalStateException("Termux APK integrity verification failed");
            }
            PackageInstaller installer = getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
                    PackageInstaller.SessionParams.MODE_FULL_INSTALL
            );
            params.setAppPackageName(TERMUX_PACKAGE);

            int sessionId = installer.createSession(params);
            PackageInstaller.Session session = installer.openSession(sessionId);
            try (InputStream in = new FileInputStream(apkFile);
                 OutputStream out = session.openWrite("termux.apk", 0, apkFile.length())) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                session.fsync(out);
            }

            Intent callback = new Intent(this, MainActivity.class);
            callback.setAction(TERMUX_INSTALL_STATUS_ACTION);
            callback.putExtra("termuxInstallSessionId", sessionId);
            String callbackNonce = randomHex(32);
            callback.putExtra("termuxInstallNonce", callbackNonce);
            boolean storedCallback = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                    .edit()
                    .putInt(INSTALL_SESSION_PREF, sessionId)
                    .putString(INSTALL_NONCE_PREF, callbackNonce)
                    .commit();
            if (!storedCallback) {
                session.abandon();
                throw new IllegalStateException("Could not secure the Termux install callback");
            }
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(
                    this,
                    TERMUX_INSTALL_STATUS_REQUEST + sessionId,
                    callback,
                    flags
            );
            session.commit(pendingIntent.getIntentSender());
            session.close();
            showBootstrap("Termux is ready to install.\nApprove the Android install prompt, then return here.", false);
        } catch (Exception e) {
            clearPendingInstallCallback();
            showBootstrap("Android blocked the built-in Termux installer.\nUse Get Termux manually, then return here.", false);
            openTermuxDownload();
        }
    }

    private boolean isTermuxInstalled() {
        try {
            getPackageManager().getPackageInfo(TERMUX_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private String installedTermuxSignerSha256() {
        try {
            int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? PackageManager.GET_SIGNING_CERTIFICATES
                    : PackageManager.GET_SIGNATURES;
            PackageInfo info = getPackageManager().getPackageInfo(TERMUX_PACKAGE, flags);
            Signature[] signatures = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signatures;
            if (signatures == null || signatures.length != 1) return null;
            return hex(MessageDigest.getInstance("SHA-256").digest(signatures[0].toByteArray()));
        } catch (Exception error) {
            return null;
        }
    }

    private boolean isTrustedTermuxSigner(String signer) {
        return constantTimeEquals(TERMUX_SIGNER_SHA256, signer)
                || constantTimeEquals(TERMUX_PLAY_STORE_SIGNER_SHA256, signer)
                || constantTimeEquals(TERMUX_DEVS_SIGNER_SHA256, signer);
    }

    private String signerLabel(String signer) {
        return signer == null ? "unavailable" : signer;
    }

    private void confirmUnverifiedTermux(String signer) {
        String fingerprint = signer == null
                ? "Android could not read its signing certificate."
                : "Certificate SHA-256: " + signer;
        showBootstrap("Termux needs verification before Marinara can send its setup command.", false);
        new AlertDialog.Builder(this)
                .setTitle("Unverified Termux installation")
                .setMessage(
                        "This Termux app is not signed by F-Droid, Google Play, or the Termux developers. "
                                + "Marinara's setup command includes a private local-access secret.\n\n"
                                + fingerprint
                                + "\n\nContinue only if you trust where this Termux app came from."
                )
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Trust for this session", (dialog, which) -> {
                    approvedUnverifiedTermuxSigner = signerLabel(signer);
                    startTermuxSetup();
                })
                .show();
    }

    private boolean hasTermuxRunCommandPermission() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || checkSelfPermission(TERMUX_RUN_COMMAND_PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    private void sendTermuxSetupCommand() {
        String signer = installedTermuxSignerSha256();
        if (!isTrustedTermuxSigner(signer) && !textEquals(approvedUnverifiedTermuxSigner, signerLabel(signer))) {
            confirmUnverifiedTermux(signer);
            return;
        }
        Intent intent = new Intent();
        intent.setClassName(TERMUX_PACKAGE, "com.termux.app.RunCommandService");
        intent.setAction("com.termux.RUN_COMMAND");
        intent.putExtra("com.termux.RUN_COMMAND_PATH", TERMUX_BASH);
        intent.putExtra("com.termux.RUN_COMMAND_WORKDIR", TERMUX_HOME);
        intent.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
        intent.putExtra("com.termux.RUN_COMMAND_SESSION_ACTION", "0");
        intent.putExtra("com.termux.RUN_COMMAND_LABEL", "Install / start Marinara Engine");
        intent.putExtra(
                "com.termux.RUN_COMMAND_DESCRIPTION",
                "Installs Git and Node.js in Termux, fetches Marinara Engine, and starts the local server.");

        try {
            intent.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[]{"-lc", buildTermuxSetupCommand(true)});
            startService(intent);
            resumeConnectionRetryLoop();
            showBootstrap("Termux setup launched.\nWatch Termux finish installing, then this shell will connect automatically.", true);
            handler.postDelayed(this::openTermux, 500);
            scheduleConnectionRetry();
        } catch (SecurityException e) {
            showTermuxExternalAppsInstructions();
        } catch (IllegalStateException | ActivityNotFoundException e) {
            showManualTermuxSetupInstructions("Android blocked the Termux setup launch.");
        }
    }

    private String buildTermuxSetupCommand(boolean provisionAndroidSecret) {
        String releaseCommitValue = BuildConfig.MARINARA_RELEASE_COMMIT;
        if (releaseCommitValue == null || !releaseCommitValue.matches("^[a-fA-F0-9]{40}$")) {
            throw new IllegalStateException("This Android build has no valid source commit");
        }
        String releaseCommit = shellQuote(releaseCommitValue.toLowerCase());
        String secretProvisioning = "";
        if (provisionAndroidSecret) {
            String androidSecret = shellQuote(getOrCreateAndroidSecret());
            secretProvisioning = "mkdir -p \"$HOME/.marinara-engine\"\n"
                    + "printf '%s\\n' " + androidSecret + " > \"$HOME/.marinara-engine/android-secret\"\n"
                    + "chmod 600 \"$HOME/.marinara-engine/android-secret\"\n";
        }
        String launcherCommand = provisionAndroidSecret
                ? "AUTO_OPEN_BROWSER=false ./start-termux.sh --skip-update\n"
                : "./start-termux.sh --skip-update\n";
        return "set -e\n"
                + "umask 077\n"
                + "pkg update -y\n"
                + "pkg install -y git nodejs-lts\n"
                + "if [ ! -d \"$HOME/Marinara-Engine/.git\" ]; then\n"
                + "  mkdir -p \"$HOME/Marinara-Engine\"\n"
                + "  git -C \"$HOME/Marinara-Engine\" init\n"
                + "fi\n"
                + "cd \"$HOME/Marinara-Engine\"\n"
                + "if git remote get-url origin >/dev/null 2>&1; then git remote set-url origin https://github.com/Pasta-Devs/Marinara-Engine.git; else git remote add origin https://github.com/Pasta-Devs/Marinara-Engine.git; fi\n"
                + "git fetch --depth 1 origin " + releaseCommit + "\n"
                + "test \"$(git rev-parse FETCH_HEAD)\" = " + releaseCommit + "\n"
                + "if [ -f scripts/protect-launcher-data.mjs ]; then\n"
                + "  guard_status=0\n"
                + "  node scripts/protect-launcher-data.mjs check-target " + releaseCommit + " || guard_status=$?\n"
                + "  if [ \"$guard_status\" -eq 2 ]; then\n"
                + "    echo 'This Marinara Android build is older than your stored data format. Install a newer APK.'\n"
                + "    exit 1\n"
                + "  elif [ \"$guard_status\" -ne 0 ]; then\n"
                + "    echo 'Could not verify that this Marinara Android build can safely read your stored data. Install a newer APK or retry later.'\n"
                + "    exit 1\n"
                + "  fi\n"
                + "fi\n"
                + "git checkout --detach -f " + releaseCommit + "\n"
                + "test \"$(git rev-parse HEAD)\" = " + releaseCommit + "\n"
                + secretProvisioning
                + "chmod +x start-termux.sh\n"
                + launcherCommand;
    }

    private String shellQuote(String value) {
        return "'" + value.replace("'", "'\"'\"'") + "'";
    }

    private void showTermuxExternalAppsInstructions() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("Marinara Termux setup", TERMUX_EXTERNAL_APPS_COMMAND));
            Toast.makeText(this, "Copied Termux permission command", Toast.LENGTH_LONG).show();
        }
        pauseConnectionRetryLoop();
        showBootstrap("Termux blocked external setup.\nPaste the copied allow-external-apps command once, then return and tap Install / Start Marinara.", false);
        openTermux();
    }

    private void showManualTermuxSetupInstructions(String reason) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            clipboard.setPrimaryClip(ClipData.newPlainText("Marinara Termux setup", buildTermuxSetupCommand(false)));
            Toast.makeText(this, "Copied Marinara setup command", Toast.LENGTH_LONG).show();
        }
        pauseConnectionRetryLoop();
        showBootstrap(
                reason
                        + "\nOpen Termux and paste the copied secret-free setup command. "
                        + "When it starts, return here, tap Retry connection, then Open manual server.",
                false
        );
        openTermux();
    }

    private void openTermuxDownload() {
        openUri(TERMUX_DOWNLOAD_PAGE);
    }

    private boolean openTermux() {
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(TERMUX_PACKAGE);
        if (launchIntent != null) {
            try {
                startActivity(launchIntent);
                return true;
            } catch (ActivityNotFoundException ignored) {
                // The status text already explains the next step.
            }
        }
        return false;
    }

    private boolean isStatusBarVisible() {
        return getSharedPreferences(DISPLAY_PREFS, MODE_PRIVATE)
                .getBoolean(STATUS_BAR_VISIBLE, false);
    }

    private void setStatusBarVisible(boolean visible) {
        getSharedPreferences(DISPLAY_PREFS, MODE_PRIVATE)
                .edit()
                .putBoolean(STATUS_BAR_VISIBLE, visible)
                .apply();
        applyStatusBarVisibility(visible);
    }

    private void applyStatusBarVisibility(boolean visible) {
        if (visible) {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            return;
        }
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
    }

    private class MarinaraAndroidBridge {
        @JavascriptInterface
        public boolean isStatusBarVisible(String token) {
            if (!isTrustedBridgeCaller(token)) return false;
            return MainActivity.this.isStatusBarVisible();
        }

        @JavascriptInterface
        public void setStatusBarVisible(String token, boolean visible) {
            if (!isTrustedBridgeCaller(token)) return;
            runOnUiThread(() -> MainActivity.this.setStatusBarVisible(visible));
        }

        @JavascriptInterface
        public String getNotificationPermission(String token) {
            if (!isTrustedBridgeCaller(token)) return "denied";
            return getNotificationPermissionStatus();
        }

        @JavascriptInterface
        public void requestNotificationPermission(String token) {
            if (!isTrustedBridgeCaller(token)) return;
            runOnUiThread(() -> {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
                        || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                        == PackageManager.PERMISSION_GRANTED) {
                    dispatchNotificationPermissionStatus("granted");
                    return;
                }
                getSharedPreferences(NOTIFICATION_PERMISSION_PREFS, MODE_PRIVATE)
                        .edit()
                        .putBoolean(NOTIFICATION_PERMISSION_REQUESTED, true)
                        .apply();
                requestPermissions(
                        new String[]{Manifest.permission.POST_NOTIFICATIONS},
                        NOTIFICATION_PERMISSION_REQUEST
                );
            });
        }

        @JavascriptInterface
        public void showNotification(String token, String title, String body, String tag) {
            if (!isTrustedBridgeCaller(token)) return;
            runOnUiThread(() -> showNativeMessageNotification(title, body, tag));
        }

        /** Saves a base64-encoded web download through Android's native storage APIs. */
        @JavascriptInterface
        public void saveFile(String token, String base64Data, String mimeType, String filename) {
            if (!isTrustedBridgeCaller(token)) return;
            new Thread(() -> {
                try {
                    byte[] data = Base64.decode(base64Data, Base64.DEFAULT);
                    String safeFilename = sanitizeDownloadFilename(filename);
                    String safeMimeType = normalizeDownloadMimeType(mimeType);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        saveFileToMediaStore(data, safeMimeType, safeFilename);
                    } else {
                        runOnUiThread(() -> beginLegacyFileSave(data, safeMimeType, safeFilename));
                    }
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(
                            MainActivity.this,
                            "Could not save the file: " + safeErrorMessage(error),
                            Toast.LENGTH_LONG
                    ).show());
                }
            }).start();
        }

        @JavascriptInterface
        public void openConsole(String token) {
            if (!isTrustedBridgeCaller(token)) return;
            runOnUiThread(() -> {
                if (!isTermuxInstalled()) {
                    Toast.makeText(
                            MainActivity.this,
                            "Termux is not installed yet. Use Install / Start Marinara first.",
                            Toast.LENGTH_LONG
                    ).show();
                    return;
                }

                if (!openTermux()) {
                    Toast.makeText(
                            MainActivity.this,
                            "Android could not open Termux. Open Termux from your launcher to view logs.",
                            Toast.LENGTH_LONG
                    ).show();
                }
            });
        }
    }

    /** Removes path separators and reserved characters from a browser-provided filename. */
    private String sanitizeDownloadFilename(String filename) {
        String safe = filename == null ? "" : filename.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
        if (safe.isEmpty()) safe = "marinara-download";
        return safe.length() > 120 ? safe.substring(0, 120) : safe;
    }

    /** Returns a safe MIME type when the browser does not provide a valid media type. */
    private String normalizeDownloadMimeType(String mimeType) {
        if (mimeType == null || !mimeType.matches("^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+$")) {
            return "application/octet-stream";
        }
        return mimeType;
    }

    /** Produces a user-facing fallback when an exception has no message. */
    private String safeErrorMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? error.getClass().getSimpleName() : message;
    }

    /** Writes a download into the app's Pictures or Downloads collection on Android 10 and newer. */
    private void saveFileToMediaStore(byte[] data, String mimeType, String filename) throws Exception {
        ContentResolver resolver = getContentResolver();
        boolean isImage = mimeType.startsWith("image/");
        Uri collection = isImage
                ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                : MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
        String directory = (isImage ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS)
                + "/Marinara";
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, directory);
        values.put(MediaStore.MediaColumns.IS_PENDING, 1);
        Uri target = resolver.insert(collection, values);
        if (target == null) throw new IllegalStateException("Android did not create a destination file");

        try {
            try (OutputStream output = resolver.openOutputStream(target)) {
                if (output == null) throw new IllegalStateException("Android did not open the destination file");
                output.write(data);
            }
            ContentValues complete = new ContentValues();
            complete.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(target, complete, null, null);
        } catch (Exception error) {
            resolver.delete(target, null, null);
            throw error;
        }

        runOnUiThread(() -> Toast.makeText(
                MainActivity.this,
                "Saved " + filename + " to " + directory,
                Toast.LENGTH_LONG
        ).show());
    }

    /** Opens Android's document picker to save a download on Android 7 through 9. */
    private void beginLegacyFileSave(byte[] data, String mimeType, String filename) {
        if (pendingFileSaveData != null) {
            Toast.makeText(this, "Finish saving the current file first.", Toast.LENGTH_SHORT).show();
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        if (intent.resolveActivity(getPackageManager()) == null) {
            Toast.makeText(this, "No Android file picker is available.", Toast.LENGTH_LONG).show();
            return;
        }
        pendingFileSaveData = data;
        pendingFileSaveName = filename;
        startActivityForResult(intent, FILE_SAVE_REQUEST);
    }

    private void createMessageNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                MESSAGE_NOTIFICATION_CHANNEL_ID,
                "Background messages",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Notifications for new Marinara character messages");
        manager.createNotificationChannel(channel);
    }

    private String getNotificationPermissionStatus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return "granted";
        }
        boolean requested = getSharedPreferences(NOTIFICATION_PERMISSION_PREFS, MODE_PRIVATE)
                .getBoolean(NOTIFICATION_PERMISSION_REQUESTED, false);
        return requested ? "denied" : "default";
    }

    private void dispatchNotificationPermissionStatus(String status) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('marinara:native-notification-permission',{detail:'"
                        + status
                        + "'}));",
                null
        );
    }

    private void showNativeMessageNotification(String rawTitle, String rawBody, String rawTag) {
        if (!"granted".equals(getNotificationPermissionStatus())) return;
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        String title = truncateNotificationText(rawTitle, "New Marinara message", 100);
        String body = truncateNotificationText(rawBody, "Open Marinara to read it.", 180);
        String tag = truncateNotificationText(rawTag, "marinara-message", 120);
        Intent openIntent = new Intent(this, MainActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this,
                tag.hashCode(),
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, MESSAGE_NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);
        Notification notification = builder
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(contentIntent)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_MESSAGE)
                .build();
        manager.notify(tag, 1, notification);
    }

    private String truncateNotificationText(String value, String fallback, int maxLength) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) normalized = fallback;
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private void openUri(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException e) {
            statusText.setText("No browser is available to open " + url);
        }
    }

    private void handleTermuxInstallStatus(Intent intent) {
        if (intent == null || !TERMUX_INSTALL_STATUS_ACTION.equals(intent.getAction())) return;

        int expectedSession = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                .getInt(INSTALL_SESSION_PREF, -1);
        String expectedNonce = getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                .getString(INSTALL_NONCE_PREF, null);
        int suppliedSession = intent.getIntExtra("termuxInstallSessionId", -1);
        int installerSession = intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, suppliedSession);
        String suppliedNonce = intent.getStringExtra("termuxInstallNonce");
        if (expectedSession < 0
                || suppliedSession != expectedSession
                || installerSession != expectedSession
                || !constantTimeEquals(expectedNonce, suppliedNonce)) {
            intent.setAction(null);
            return;
        }

        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmationIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmationIntent != null) {
                pauseConnectionRetryLoop();
                showBootstrap("Approve the Termux install prompt.\nMarinara will continue setup afterward.", false);
                startActivity(confirmationIntent);
            }
            return;
        }

        clearPendingInstallCallback();

        if (status == PackageInstaller.STATUS_SUCCESS) {
            showBootstrap("Termux installed.\nContinuing Marinara setup…", true);
            pendingStartAfterTermuxInstall = false;
            startTermuxSetup();
            return;
        }

        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
            showBootstrap("Termux installation was cancelled.\nTap Install / Start Marinara to try again.", false);
            return;
        }
        showBootstrap("Termux installation failed.\n" + (message != null ? message : "Use Get Termux manually, then return here."), false);
    }

    private void clearPendingInstallCallback() {
        getSharedPreferences(SECURITY_PREFS, MODE_PRIVATE)
                .edit()
                .remove(INSTALL_SESSION_PREF)
                .remove(INSTALL_NONCE_PREF)
                .apply();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleTermuxInstallStatus(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        applyStatusBarVisibility(isStatusBarVisible());
        if (pendingStartAfterTermuxInstall && isTermuxInstalled()) {
            pendingStartAfterTermuxInstall = false;
            showBootstrap("Termux installed.\nContinuing Marinara setup…", true);
            startTermuxSetup();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTIFICATION_PERMISSION_REQUEST) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            dispatchNotificationPermissionStatus(granted ? "granted" : "denied");
            return;
        }
        if (requestCode != TERMUX_PERMISSION_REQUEST) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            sendTermuxSetupCommand();
        } else {
            showBootstrap("Run commands permission was not granted.\nGrant it from Android App Info > Permissions, then tap Install / Start Marinara.", false);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileUploadCallback != null) {
                Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                fileUploadCallback.onReceiveValue(result);
                fileUploadCallback = null;
            }
        } else if (requestCode == FILE_SAVE_REQUEST) {
            byte[] fileData = pendingFileSaveData;
            String fileName = pendingFileSaveName;
            pendingFileSaveData = null;
            pendingFileSaveName = null;
            Uri destination = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (fileData != null && destination != null) {
                new Thread(() -> {
                    try (OutputStream output = getContentResolver().openOutputStream(destination)) {
                        if (output == null) throw new IllegalStateException("Android did not open the destination file");
                        output.write(fileData);
                        runOnUiThread(() -> Toast.makeText(
                                MainActivity.this,
                                "Saved " + fileName,
                                Toast.LENGTH_LONG
                        ).show());
                    } catch (Exception error) {
                        runOnUiThread(() -> Toast.makeText(
                                MainActivity.this,
                                "Could not save the file: " + safeErrorMessage(error),
                                Toast.LENGTH_LONG
                        ).show());
                    }
                }).start();
            }
        } else if (requestCode == UNKNOWN_APP_SOURCES_REQUEST) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getPackageManager().canRequestPackageInstalls()) {
                downloadAndInstallTermux();
            } else {
                showBootstrap("Install permission was not enabled.\nEnable Allow from this source, or use Get Termux manually.", false);
            }
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        bridgeEnabled = false;
        bridgeToken = null;
        cancelPendingConnectionRetry();
        handler.removeCallbacksAndMessages(null);
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
