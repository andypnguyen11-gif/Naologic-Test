using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Naologic_API.Configuration;
using Naologic_API.Models.Auth;

namespace Naologic_API.Services;

public sealed class JwtTokenService
{
    private readonly JwtSettings _jwtSettings;

    public JwtTokenService(IConfiguration configuration)
    {
        _jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
            ?? throw new InvalidOperationException("Jwt settings are not configured.");
    }

    public AuthResponse CreateAuthResponse(AppUserAccount user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.GivenName, user.FirstName),
            new(ClaimTypes.Surname, user.LastName),
            new(ClaimTypes.Role, user.Role)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        var token = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
        return new AuthResponse(token, new AuthUserResponse(user.UserId, user.Email, user.FirstName, user.LastName, user.Role));
    }
}
