---

### **Stable Euro Coin & Exchange Programs - README**  

## **Overview**  
The **Stable Euro Coin (Stable€) Ecosystem** is a suite of **three Solana Anchor programs** designed to facilitate **stablecoin management, exchange rates, and decentralized trading** with real-time price updates from **Pyth Network**. These programs include:  

1. **Stable Exchange Client** – Handles order execution and user interactions.  
2. **Stable Exchange Rate** – Fetches and updates exchange rates via **Pyth price feeds**.  
3. **Stable EUR Coin** – Manages the issuance and transactions of the Stable Euro Coin (**Stable€**).  

This system ensures:  
- **Accurate exchange rates** using Pyth Network.  
- **Fee distribution & compliance mechanisms** for security.  
- **Seamless stablecoin transactions** on the Solana blockchain.  

---

## **Key Features**  

### **1. Stable Exchange Client (Order Execution & Trading Engine)**  
- **Handles order placement, matching, and execution** for EUR-based transactions.  
- **Supports P2P transactions** with built-in fee logic.  
- **Interacts with Pyth Network** for real-time price accuracy.  

### **2. Stable Exchange Rate (Dynamic Pricing with Pyth)**  
- **Integrates Pyth price feeds** for:  
  - **EUR to USD conversion**  
  - **USD to SOL conversion**  
- **Updates exchange rates dynamically on-chain** based on Pyth’s oracle data.  
- **Ensures minimal slippage** by fetching the latest market prices.  

### **3. Stable EUR Coin (Stablecoin Management)**  
- **Token pegged 1:1 to Euro**, backed by reserves.  
- **Supports P2P transfers with zero fees.**  
- **Implements an emergency burn mechanism** for security.  
- **MiCA-compliant design** for transparency & accountability.  
- **Metadata support for token visibility.**  

---

## **Fee Distribution Mechanism**  
Transaction fees are dynamically split across stakeholders:  
- **33.33%** → Validators  
- **16.67%** → Admin  
- **16.67%** → Partner A  
- **16.67%** → Partner B  
- **16.67%** → Partner C  

📌 **Note:** P2P transactions incur **zero** transaction fees.  

---

## **Pyth Feed Integration**  
Pyth price feeds are used for:  
✔ **EUR → USD conversion**  
✔ **USD → SOL conversion**  
✔ **Dynamic exchange rate updates**  

The **Stable Exchange Rate** program continuously updates rates based on Pyth data to ensure accurate pricing.  

---

## **Emergency Burn Mechanism**  
- Admin has the authority to invoke **an emergency burn** in case of security risks.  
- The mechanism **validates transactions** to prevent unauthorized actions.  

---

## **MiCA Compliance**  
- **Full reserve backing** ensures 1:1 peg with Euro.  
- **Transparent fees & auditable reserves.**  
- **Reliable price accuracy via Pyth.**  
- **User protection measures in place.**  

---

## **Prerequisites**  
Ensure the following dependencies are installed:  

### **1. Rust**  
```bash
rustup install 1.79.0
rustup defualt 1.79.0
```

### **2. Solana CLI**  
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
```

### **3. Anchor CLI**  
```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli
```

### **4. Node.js (for testing)**  
```bash
nvm install 20
nvm use 20
```

### **5. Other Dependencies**  
```toml
[dependencies]
mpl-token-metadata = "3.2.3"
spl-token = "4.0.0"
pyth-sdk-solana = "0.8.0"
num_enum = "0.7.2"
```

---

## **Building the Smart Contracts**  
Compile all three programs:  
```bash
anchor build
```

---

## **Deploying to Devnet**  

1. Configure Solana Devnet:  
   ```bash
   solana config set --url https://api.devnet.solana.com
   ```

2. Deploy the programs:  
   ```bash
   anchor deploy
   ```

3. Verify deployments:  
   ```bash
   solana program show <PROGRAM_ID>
   ```

---

## **Dynamic Pyth Feed Configuration**  
- Admin can update **Pyth feed addresses** on-chain.  
- Uses **admin-only instructions** to modify feed settings securely.  

---

## **Testing the Smart Contracts**  
**Run tests using Anchor:**  
```bash
anchor test
```

**Run Rust tests manually:**  
```bash
cargo test
```

---

## **Future Enhancements**  
🔹 **Multi-Signature Validation**: Secure admin actions with multi-sig approvals.  
🔹 **Mainnet Deployment**: Ensure full compliance before launching.  
🔹 **Optimized Order Matching**: Improve trading efficiency for Stable Exchange Client.  

---

## **License**  
This project is licensed under the **MIT License**. See the full license in [`LICENSE.md`](LICENSE.md).  


