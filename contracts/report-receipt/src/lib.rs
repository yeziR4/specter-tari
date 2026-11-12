use tari_template_lib::prelude::*;

#[template]
mod report_receipt {
    use super::*;

    /// Immutable commitment only. Does not certify report correctness or privacy.
    pub struct SpecterReportReceipt {
        report_sha256: String,
        transaction_id: String,
        author: RistrettoPublicKeyBytes,
        recorded_epoch: u64,
    }

    impl SpecterReportReceipt {
        pub fn commit(report_sha256: String, transaction_id: String) -> Component<Self> {
            for value in [&report_sha256, &transaction_id] {
                assert!(value.len() == 64 && value.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)), "Expected 64 lowercase hex characters");
            }
            Component::new(Self {
                report_sha256,
                transaction_id,
                author: CallerContext::transaction_signer_public_key(),
                recorded_epoch: Consensus::current_epoch(),
            })
            .with_owner_rule(OwnerRule::None)
            .with_upgrade_rule(UpdateRule::Locked)
            .with_access_rules(ComponentAccessRules::allow_all())
            .create()
        }
        pub fn report_hash(&self) -> String { self.report_sha256.clone() }
        pub fn transaction_id(&self) -> String { self.transaction_id.clone() }
        pub fn author(&self) -> RistrettoPublicKeyBytes { self.author }
        pub fn recorded_epoch(&self) -> u64 { self.recorded_epoch }
        pub fn schema_version(&self) -> u32 { 1 }
    }
}
