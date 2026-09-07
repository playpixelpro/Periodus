import Capacitor

@objc(PeriodusBridgeViewController)
final class PeriodusBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PeriodusNativePlugin())
    }
}

