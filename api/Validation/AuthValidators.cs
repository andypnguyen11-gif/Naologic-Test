using Naologic_API.Models.Auth;

namespace Naologic_API.Validation;

public static class AuthValidators
{
    public static Dictionary<string, string[]>? ValidateSignupRequest(SignupRequest request)
    {
        var errors = ValidateLoginRequest(new LoginRequest(request.Email, request.Password)) ?? new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.FirstName))
        {
            errors["firstName"] = ["First name is required."];
        }

        if (string.IsNullOrWhiteSpace(request.LastName))
        {
            errors["lastName"] = ["Last name is required."];
        }

        return errors.Count > 0 ? errors : null;
    }

    public static Dictionary<string, string[]>? ValidateLoginRequest(LoginRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            errors["email"] = ["Email is required."];
        }
        else if (!request.Email.Contains('@'))
        {
            errors["email"] = ["Email must be valid."];
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            errors["password"] = ["Password is required."];
        }
        else if (request.Password.Length < 8)
        {
            errors["password"] = ["Password must be at least 8 characters long."];
        }

        return errors.Count > 0 ? errors : null;
    }
}
