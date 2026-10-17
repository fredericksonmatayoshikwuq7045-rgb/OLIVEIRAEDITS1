pub fn arguments(action: &str) -> Result<Option<Vec<&'static str>>, String> {
    match action {
        "none" => Ok(None),
        "shutdown" => Ok(Some(vec!["/s", "/t", "60", "/c", "Oliveira Edits: lote finalizado. Use shutdown /a para cancelar."])),
        "hibernate" => Ok(Some(vec!["/h"])),
        _ => Err("Ação ao terminar inválida.".into()),
    }
}
pub fn validate(action: &str) -> Result<(), String> {
    let requested = arguments(action)?.is_some();
    if requested && !cfg!(windows) { return Err("Desligar e hibernar são opções exclusivas do Windows.".into()); }
    Ok(())
}
pub fn schedule(action: &str) -> Result<(), String> {
    let Some(args) = arguments(action)? else { return Ok(()) };
    validate(action)?;
    let result = super::process::background_command("shutdown.exe").args(args).output().map_err(|error| error.to_string())?;
    if result.status.success() { Ok(()) } else { Err(String::from_utf8_lossy(&result.stderr).into_owned()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn actions_have_fixed_arguments_and_never_execute_in_tests() {
        assert!(arguments("none").unwrap().is_none());
        assert_eq!(arguments("hibernate").unwrap().unwrap(), vec!["/h"]);
        assert!(arguments("shutdown").unwrap().unwrap().contains(&"60"));
        assert!(arguments("shutdown /s").is_err());
        if !cfg!(windows) { assert!(validate("shutdown").is_err()); }
    }
}
