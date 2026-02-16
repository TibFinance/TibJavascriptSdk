# TIB Finance JavaScript (Browser) SDK

![JavaScript](https://img.shields.io/badge/javascript-ES6%2B-yellow)

Browser JavaScript SDK for the TIB Finance payment processing API.

## Installation

```bash
git clone https://github.com/TibFinance/TibJavascriptSdk.git
```

Include in your HTML (all four scripts are required):

```html
<!-- jQuery 3.x is required for HTTP transport -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

<script src="tib-finance/security.min.js"></script>
<script src="tib-finance/CryptoCaller.js"></script>
<script src="tib-finance/ServerCaller.js"></script>
```

## Quick Start

```javascript
// Initialize with your credentials
CryptoCaller.initialize(
    "https://sandboxportal.tib.finance",
    "your_service_id",
    "your_client_id",
    "your_username",
    "your_password"
);

// Create a session
ServerCaller.createSession("your_client_id", "your_username", "your_password")
  .then(response => {
    console.log("Session created:", response);
  });
```

## Documentation

For the complete API reference and guides, visit [doc.tib.finance](https://doc.tib.finance).

This SDK provides access to **56 API methods** for payment processing, merchant management, and financial operations.

## Other TIB Finance SDKs

| SDK | Repository |
|-----|------------|
| Python | [TibPythonSdk](https://github.com/TibFinance/TibPythonSdk) |
| Java | [TibJavaSdk](https://github.com/TibFinance/TibJavaSdk) |
| .NET Core | [TibDotNetCoreSdk](https://github.com/TibFinance/TibDotNetCoreSdk) |
| .NET Framework | [TibDotNetSdk](https://github.com/TibFinance/TibDotNetSdk) |
| PHP | [TibPhpSdk](https://github.com/TibFinance/TibPhpSdk) |
| Node.js | [TibNodeJsSdk](https://github.com/TibFinance/TibNodeJsSdk) |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [doc.tib.finance](https://doc.tib.finance)
- Email: support@tib.finance
