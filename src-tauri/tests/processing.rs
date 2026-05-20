use os_notetaker_lib::providers::{
    generation::{generate_note_from_transcript, GenerationRequest},
    transcription::{
        normalize_transcription_language, transcribe_saved_audio, TranscriptionRequest,
    },
};
use tempfile::NamedTempFile;

#[tokio::test]
async fn mock_transcription_returns_retryable_transcript_from_saved_audio() {
    let file = NamedTempFile::new().expect("temp audio");
    std::fs::write(file.path(), b"audio").expect("audio bytes");

    let transcript = transcribe_saved_audio(TranscriptionRequest {
        provider: "mock".to_string(),
        audio_path: file.path().to_path_buf(),
        title: "Planning note".to_string(),
        context: None,
    })
    .await
    .expect("mock transcription should succeed");

    assert!(transcript.text.contains("Planning note"));
    assert_eq!(transcript.provider, "mock");
}

#[tokio::test]
async fn mock_transcription_fails_for_missing_audio() {
    let err = transcribe_saved_audio(TranscriptionRequest {
        provider: "mock".to_string(),
        audio_path: "/tmp/os-notetaker-missing.wav".into(),
        title: "Missing".to_string(),
        context: None,
    })
    .await
    .expect_err("missing audio should fail");

    assert_eq!(err.code, "audio_artifact_missing");
}

#[tokio::test]
async fn generation_uses_transcript_without_inventing_extra_sections() {
    let generated = generate_note_from_transcript(GenerationRequest {
        provider: "mock".to_string(),
        title: "Launch notes".to_string(),
        transcript: "We decided to ship the Tauri notes MVP after validation.".to_string(),
        manual_notes: None,
        language: Some("en".to_string()),
    })
    .await
    .expect("mock generation should succeed");

    assert!(generated.content.contains("We decided to ship"));
    assert_eq!(generated.prompt_version, "notes-mvp-v2");
}

#[tokio::test]
async fn generation_combines_manual_notes_with_transcript() {
    let generated = generate_note_from_transcript(GenerationRequest {
        provider: "mock".to_string(),
        title: "Meeting notes".to_string(),
        transcript: "System: The launch deadline is Friday.".to_string(),
        manual_notes: Some("Ask Marta about the release checklist.".to_string()),
        language: Some("en".to_string()),
    })
    .await
    .expect("mock generation should use manual notes and transcript");

    assert!(generated.content.contains("Manual notes"));
    assert!(generated.content.contains("Ask Marta"));
    assert!(generated.content.contains("Transcript"));
    assert!(generated.content.contains("launch deadline"));
}

#[tokio::test]
async fn generation_rejects_empty_transcript() {
    let err = generate_note_from_transcript(GenerationRequest {
        provider: "mock".to_string(),
        title: "Empty".to_string(),
        transcript: "   ".to_string(),
        manual_notes: None,
        language: None,
    })
    .await
    .expect_err("empty transcript should fail");

    assert_eq!(err.code, "transcription_empty");
}

#[test]
fn transcription_language_override_accepts_iso_639_1_codes() {
    assert_eq!(
        normalize_transcription_language(" es "),
        Some("es".to_string())
    );
    assert_eq!(
        normalize_transcription_language("EN"),
        Some("en".to_string())
    );
}

#[test]
fn transcription_language_override_rejects_invalid_values() {
    assert_eq!(normalize_transcription_language(""), None);
    assert_eq!(normalize_transcription_language("spanish"), None);
    assert_eq!(normalize_transcription_language("es-ES"), None);
}
