# Security Guidelines

## Important Security Notes

**WARNING**: This tool processes Kubernetes secrets locally in your browser. For maximum security:

1. **Use only in trusted environments**
2. **Clear browser data after use** (localStorage contains secret data)
3. **Avoid using on shared computers**
4. **Do not use with production secrets on public networks**

## Security Features

- All processing happens locally in browser (no server upload)
- No network requests for secret data
- localStorage can be manually cleared

## Recommended Usage

- Use for development/testing secrets only
- Clear browser localStorage after each session
- Use in private browsing mode for sensitive data

## Clear Data

To manually clear stored data:
```javascript
localStorage.removeItem('yamlContent');
localStorage.removeItem('secretObject');
```
