namespace Resto.Api.Features.Statistiques;

public record ResumeResponse(
    DateOnly Du,
    DateOnly Au,
    ResumeValeurs Periode,
    DateOnly PrecedenteDu,
    DateOnly PrecedenteAu,
    ResumeValeurs Precedente,
    ResumeVariations Variation);
