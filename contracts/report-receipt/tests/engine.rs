use tari_ootle_transaction::{Epoch, Transaction, args};
use tari_template_lib::types::ComponentAddress;
use tari_template_test_tooling::TemplateTest;
const ROOT: &str = env!("CARGO_MANIFEST_DIR");
#[test]
fn commits_exact_hash_and_tx_then_reads_without_mutation() {
    let mut t = TemplateTest::new(ROOT, ["tests/templates/specter_receipt"]);
    let expected_epoch = t.current_epoch().as_u64();
    let hash = "ab".repeat(32);
    let txid = "cd".repeat(32);
    t.execute_expect_success(Transaction::builder_localnet(Epoch(1))
        .call_function(t.get_template_address("SpecterReportReceipt"), "commit", args![hash.clone(), txid.clone()])
        .build_and_seal(t.secret_key()), vec![]);
    let addr = t.return_values()[0].decoded::<ComponentAddress>().unwrap();
    let component = t.read_only_state_store().get_component(addr).unwrap();
    assert!(matches!(component.owner_rule(), tari_template_lib::types::SubstateOwnerRule::None));
    assert!(matches!(component.upgrade_rule(), tari_template_lib::prelude::UpdateRule::Locked));
    let stored: String = t.call_method(addr, "report_hash", args![], vec![]);
    assert_eq!(stored, hash);
    let tx: String = t.call_method(addr, "transaction_id", args![], vec![]);
    assert_eq!(tx, txid);
    let version: u32 = t.call_method(addr, "schema_version", args![], vec![]);
    assert_eq!(version, 1);
    let epoch: u64 = t.call_method(addr, "recorded_epoch", args![], vec![]);
    assert_eq!(epoch, expected_epoch);
    let reason = t.execute_expect_failure(Transaction::builder_localnet(Epoch(1))
        .call_method(addr, "set_report_hash", args!["ef".repeat(32)])
        .build_and_seal(t.secret_key()), vec![]);
    assert!(!format!("{reason:?}").is_empty());
}
#[test]
fn rejects_malformed_commitments_and_transaction_ids() {
    let mut t = TemplateTest::new(ROOT, ["tests/templates/specter_receipt"]);
    for (hash, txid) in [("a".repeat(63), "cd".repeat(32)), ("AB".repeat(32), "cd".repeat(32)), ("gg".repeat(32), "cd".repeat(32)), ("ab".repeat(32), "short".to_owned())] {
        let reason = t.execute_expect_failure(Transaction::builder_localnet(Epoch(1))
            .call_function(t.get_template_address("SpecterReportReceipt"), "commit", args![hash, txid])
            .build_and_seal(t.secret_key()), vec![]);
        assert!(format!("{reason:?}").contains("Expected 64 lowercase hex characters"));
    }
}

