//
//  SafariWebExtensionHandler.swift
//  SafariStart Extension
//
//  Created by Andrey Privalov on 18.09.2026.
//

import SafariServices
import os.log

// Handles browser.runtime.sendNativeMessage from the new tab page.
// The only request is {action: "fetch", url}: the page can't read cross-origin
// responses (favicon services send no CORS headers), so the download happens here.
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    private static let maxBytes = 2 * 1024 * 1024

    private static let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.timeoutIntervalForResource = 15
        config.httpAdditionalHeaders = [
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
        ]
        return URLSession(configuration: config)
    }()

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        guard let body = message as? [String: Any],
              body["action"] as? String == "fetch",
              let urlString = body["url"] as? String,
              let url = URL(string: urlString),
              url.scheme == "http" || url.scheme == "https" else {
            os_log(.error, "Unsupported native message: %@", String(describing: message))
            reply(context, ["ok": false, "error": "unsupported request"])
            return
        }

        Self.session.dataTask(with: url) { data, response, fetchErr in
            if let fetchErr {
                self.reply(context, ["ok": false, "error": fetchErr.localizedDescription])
                return
            }
            let http = response as? HTTPURLResponse
            let bytes = data ?? Data()
            guard bytes.count <= Self.maxBytes else {
                self.reply(context, ["ok": false, "error": "response too large"])
                return
            }
            self.reply(context, [
                "ok": true,
                "status": http?.statusCode ?? 0,
                "type": http?.value(forHTTPHeaderField: "Content-Type") ?? "",
                "url": response?.url?.absoluteString ?? urlString,
                "body": bytes.base64EncodedString(),
            ])
        }.resume()
    }

    private func reply(_ context: NSExtensionContext, _ payload: [String: Any]) {
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [ SFExtensionMessageKey: payload ]
        } else {
            response.userInfo = [ "message": payload ]
        }
        context.completeRequest(returningItems: [ response ], completionHandler: nil)
    }

}
