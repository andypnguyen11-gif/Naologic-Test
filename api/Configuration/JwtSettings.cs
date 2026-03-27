namespace Naologic_API.Configuration;

public sealed record JwtSettings(string Issuer, string Audience, string SigningKey)
{
    public const string SectionName = "Jwt";
}
