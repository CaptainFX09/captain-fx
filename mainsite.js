/* ==========================================================================
   MAINSITE.JS — PipZoNe (Managed Forex & Crypto Trading)
   Table of contents:
     1. Config / constants (Supabase keys, deposit addresses, business rules)
     2. Global state
     3. DOM helper + message helpers
     4. Supabase init
     5. Live stats strip (homepage)
     6. Deposit address copy helper
     7. Network selector (deposit + withdrawal)
     8. Auth modal open/close/switch helpers
     9. Password reset flow
    10. Signup / wallet validation helpers
    11. Signup
    12. Login
    13. Dashboard loader (profile + account sync)
    14. Available-to-withdraw calculation (incl. pending withdrawals)
    15. Account summary rendering (balance, profit, unlock progress)
    16. Withdrawal fee calculator (UI)
    17. Deposit / Withdrawal request modals (open/close)
    18. Submit deposit request
    19. Submit withdrawal request
    20. Recent transactions list
    21. Notification bell + popup (server-synced read state)
    22. Contact form submission
    23. Logout
    24. Profit-split calculator (homepage widget)
    25. Page bootstrap / event listeners
   ========================================================================== */

'use strict';

/* -------------------------- 1. Config / constants -------------------------- */
const SUPABASE_URL='https://nzasmkplxzirnqeteclv.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_ywmF35YANKsFEdZOs8wDdQ__jIezHTF';

const DEPOSIT_ADDRESSES={
  TRC20:'TZ1xrSedo6vPVqc6kY2fE7JDunsVoJZUT8',
  BEP20:'0xf4a61fbfc905b5b66077878e12ffa4566374d54d'
};

const PRINCIPAL_LOCK_DAYS=40;
const WITHDRAWAL_FEE=2;

/* -------------------------- 2. Global state -------------------------- */
let selectedDepositNetwork='TRC20';
let selectedWithdrawalNetwork='TRC20';

let supabaseClient=null;
let supabaseReady=false;
let currentUser=null;
let currentAccount=null;
let currentProfile=null;
let currentNotificationItems=[];

/* -------------------------- 3. DOM helper + message helpers -------------------------- */
function $(id){return document.getElementById(id)}

const modal=$('authModal');

function showMsg(id,text,error=true){
const e=$(id);
if(!e)return;
e.textContent=text;
e.style.color=error?'var(--loss)':'var(--profit)';
e.classList.add('show');
}

function clearMessages(){
document.querySelectorAll('.msg').forEach(e=>e.classList.remove('show'));
}

/* -------------------------- 4. Supabase init -------------------------- */
function initSupabase(){
try{
if(!window.supabase || typeof window.supabase.createClient!=='function'){
console.error('Supabase library did not load.');
return false;
}
supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
supabaseReady=true;
return true;
}catch(err){
console.error('Supabase initialization error:',err);
supabaseReady=false;
return false;
}
}

/* -------------------------- 5. Live stats strip (homepage) -------------------------- */
async function loadLiveStats(){
if(!supabaseReady)return;
try{
const {data,error}=await supabaseClient.rpc('get_public_stats');
if(error){console.error('Live stats error:',error);return}
const clientsEl=$('liveClients'),depositsEl=$('liveDeposits'),withdrawalsEl=$('liveWithdrawals');
if(clientsEl)clientsEl.textContent=Number(data.total_clients||0).toLocaleString();
if(depositsEl)depositsEl.textContent='$'+Number(data.total_verified_deposits||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});
if(withdrawalsEl)withdrawalsEl.textContent='$'+Number(data.total_verified_withdrawals||0).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0});
}catch(err){console.error('Live stats error:',err)}
}

/* -------------------------- 6. Deposit address copy helper -------------------------- */
function copyDepositAddress(){
const field=$('depositAddressField');
if(!field||!field.value)return;
navigator.clipboard?.writeText(field.value).then(()=>{
showMsg('depositMsg','Address copied to clipboard.',false);
}).catch(()=>{});
}

/* -------------------------- 7. Network selector (deposit + withdrawal) -------------------------- */

/* NETWORK SELECTOR FOR DEPOSIT */
function selectDepositNetwork(net){
selectedDepositNetwork=net;
$('tab-TRC20').classList.toggle('active',net==='TRC20');
$('tab-BEP20').classList.toggle('active',net==='BEP20');
$('depositAddressField').value=DEPOSIT_ADDRESSES[net];
$('depositNetworkLabel').textContent='('+net+')';
}

/* NETWORK SELECTOR FOR WITHDRAWAL
   Prefills the saved wallet for the chosen network from the client's profile,
   so withdrawal network matches whichever wallet they registered for it. */
function selectWithdrawalNetwork(net){
selectedWithdrawalNetwork=net;
$('wd-tab-TRC20').classList.toggle('active',net==='TRC20');
$('wd-tab-BEP20').classList.toggle('active',net==='BEP20');

const label=$('withdrawalWalletLabel');
const input=$('withdrawalWallet');
const note=$('withdrawalWalletNote');

if(net==='TRC20'){
label.textContent='TRC20 Withdrawal Wallet';
input.placeholder='T...';
input.value=currentProfile?.wallet_address||'';
}else{
label.textContent='BEP20 Withdrawal Wallet';
input.placeholder='0x...';
input.value=currentProfile?.wallet_address_bep20||'';
}

if(input.value){
note.textContent='This is the wallet saved on your account for '+net+'. You can edit it if needed.';
}else{
note.textContent='No saved '+net+' wallet found on your account. Enter one below, or contact support to add it to your profile.';
}
}

/* -------------------------- 8. Auth modal open/close/switch helpers -------------------------- */
function openAuth(mode){
clearMessages();
modal.classList.add('show');
document.body.classList.add('modal-open');
mode==='signup'?showSignup():showLogin();
}

function closeAuth(){
modal.classList.remove('show');
document.body.classList.remove('modal-open');
clearMessages();
}

function hideAuthForms(){
$('loginForm').style.display='none';
$('signupForm').style.display='none';
$('resetPasswordForm').style.display='none';
$('newPasswordForm').style.display='none';
}

function showSignup(){
hideAuthForms();
$('signupForm').style.display='block';
clearMessages();
}

function showLogin(){
hideAuthForms();
$('loginForm').style.display='block';
clearMessages();
}

function showResetPassword(){
modal.classList.add('show');
document.body.classList.add('modal-open');
hideAuthForms();
$('resetPasswordForm').style.display='block';
clearMessages();
const loginEmail=$('loginEmail')?.value.trim();
if(loginEmail){$('resetEmail').value=loginEmail}
setTimeout(()=>{$('resetEmail')?.focus()},50);
}

function showNewPasswordForm(){
modal.classList.add('show');
document.body.classList.add('modal-open');
hideAuthForms();
$('newPasswordForm').style.display='block';
clearMessages();
setTimeout(()=>{$('newPassword')?.focus()},50);
}

/* -------------------------- 9. Password reset flow -------------------------- */
async function sendResetEmail(){
clearMessages();
if(!supabaseReady){showMsg('resetMsg','Connection is not ready. Please refresh the page and try again.');return}
const email=$('resetEmail').value.trim();
if(!email){showMsg('resetMsg','Please enter your account email.');return}
const button=$('resetPasswordForm').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Sending...'}
try{
const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin});
if(error){console.error('Reset email error:',error);showMsg('resetMsg',error.message);return}
showMsg('resetMsg','Password reset link has been sent to your email. Please check your inbox and spam folder.',false);
}catch(err){console.error(err);showMsg('resetMsg','Unable to send reset email right now. Please try again.')}
finally{if(button){button.disabled=false;button.textContent='Send reset link'}}
}

async function updatePassword(){
clearMessages();
if(!supabaseReady){showMsg('newPasswordMsg','Connection is not ready. Please refresh the page and try again.');return}
const password=$('newPassword').value;
const confirm=$('confirmNewPassword').value;
if(!password){showMsg('newPasswordMsg','Please enter your new password.');return}
if(password.length<6){showMsg('newPasswordMsg','Password must be at least 6 characters.');return}
if(!confirm){showMsg('newPasswordMsg','Please confirm your new password.');return}
if(password!==confirm){showMsg('newPasswordMsg','Passwords do not match.');return}
const button=$('newPasswordForm').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Updating...'}
try{
const {error}=await supabaseClient.auth.updateUser({password:password});
if(error){console.error('Password update error:',error);showMsg('newPasswordMsg',error.message);return}
$('newPassword').value='';
$('confirmNewPassword').value='';
showMsg('newPasswordMsg','Password updated successfully. You can now login with your new password.',false);
setTimeout(()=>{
try{window.history.replaceState({},document.title,window.location.pathname)}catch(e){}
showLogin();
},1500);
}catch(err){console.error(err);showMsg('newPasswordMsg','Unable to update password right now. Please try again.')}
finally{if(button){button.disabled=false;button.textContent='Update password'}}
}

/* -------------------------- 10. Signup / wallet validation helpers -------------------------- */
function friendlySignupError(msg){
const m=String(msg||'').toLowerCase();
if(m.includes('profiles_phone_unique')||(m.includes('phone')&&m.includes('duplicate'))){
return 'This phone number is already linked to another account. One account is allowed per phone number.';
}
if(m.includes('profiles_wallet_address_bep20_unique')){
return 'This BEP20 wallet address is already linked to another account. One account is allowed per wallet.';
}
if(m.includes('profiles_wallet_address_unique')||(m.includes('wallet')&&m.includes('duplicate'))){
return 'This TRC20 wallet address is already linked to another account. One account is allowed per wallet.';
}
if(m.includes('duplicate key value')||m.includes('already registered')||m.includes('user already registered')){
return 'An account already exists with these details.';
}
return msg;
}

function validWallet(w){
return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(w)
}

function validBep20Wallet(w){
return /^0x[a-fA-F0-9]{40}$/.test(w)
}

function togglePw(id,btn){
const input=$(id);
if(!input)return;
const isHidden=input.type==='password';
input.type=isHidden?'text':'password';
btn.textContent=isHidden?'🙈':'👁';
btn.setAttribute('aria-label',isHidden?'Hide password':'Show password');
}

/* -------------------------- 11. Signup -------------------------- */
async function signup(){
clearMessages();
if(!supabaseReady){showMsg('signupMsg','Connection is not ready. Please refresh the page and try again.');return}
const name=$('fullName').value.trim();
const email=$('signupEmail').value.trim();
const phone=$('phone').value.trim();
const wallet=$('wallet').value.trim();
const walletBep20=$('walletBep20').value.trim();
const pass=$('signupPassword').value;
const confirm=$('confirmPassword').value;
if(!name||!email||!pass){showMsg('signupMsg','Please fill Full Name, Email and Password.');return}
if(!wallet&&!walletBep20){showMsg('signupMsg','Please provide at least one withdrawal wallet address (TRC20 or BEP20).');return}
if(wallet&&!validWallet(wallet)){showMsg('signupMsg','Please enter a valid TRC20 wallet address starting with T, or leave it blank.');return}
if(walletBep20&&!validBep20Wallet(walletBep20)){showMsg('signupMsg','Please enter a valid BEP20 wallet address starting with 0x, or leave it blank.');return}
if(pass.length<6){showMsg('signupMsg','Password must be at least 6 characters.');return}
if(pass!==confirm){showMsg('signupMsg','Passwords do not match.');return}
const button=$('signupForm').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Creating...'}
try{
const {data,error}=await supabaseClient.auth.signUp({
email,password:pass,
options:{data:{full_name:name,phone,wallet_address:wallet||null,wallet_address_bep20:walletBep20||null},emailRedirectTo:window.location.origin}
});
if(error){showMsg('signupMsg',friendlySignupError(error.message));return}
if(data&&data.session){
/* If a session exists immediately (no email confirmation required),
   also write the wallets directly to the profile row as a safety net,
   in case the database trigger that creates the profile hasn't been
   updated yet to copy the new BEP20 field. */
try{
await supabaseClient.from('profiles').update({
  full_name:name,
  phone:phone,
  wallet_address:wallet||null,
  wallet_address_bep20:walletBep20||null
}).eq('id',data.user.id);
}catch(profileErr){
console.error('Profile wallet sync error:',profileErr);
}
closeAuth();await loadDashboard();
}
else showMsg('signupMsg','Account created. Please check your email to verify your account.',false);
}catch(err){console.error(err);showMsg('signupMsg','Unable to create account right now. Please try again.')}
finally{if(button){button.disabled=false;button.textContent='Create account'}}
}

/* -------------------------- 12. Login -------------------------- */
async function login(){
clearMessages();
if(!supabaseReady){showMsg('loginMsg','Connection is not ready. Please refresh the page and try again.');return}
const email=$('loginEmail').value.trim();
const password=$('loginPassword').value;
if(!email||!password){showMsg('loginMsg','Enter email and password.');return}
const button=$('loginForm').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Logging in...'}
try{
const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
if(error){showMsg('loginMsg',error.message);return}
closeAuth();await loadDashboard();
}catch(err){console.error(err);showMsg('loginMsg','Unable to login right now. Please try again.')}
finally{if(button){button.disabled=false;button.textContent='Login'}}
}

/* -------------------------- 13. Dashboard loader (profile + account sync) -------------------------- */
async function loadDashboard(){
if(!supabaseReady)return;

try{

const {data:{user},error:userError}=await supabaseClient.auth.getUser();

if(userError||!user)return;

currentUser=user;

$('home').style.display='none';
$('dashboard').style.display='block';

document.querySelector('footer').style.display='none';
document.querySelector('header').style.display='none';

const contactSection=$('contact');
if(contactSection)contactSection.style.display='none';

/* ================= PROFILE ================= */

/* notifications_seen_at is the server-side "last time this client opened
   and cleared their notifications" timestamp. Storing it on the profile
   row (instead of only in this browser's localStorage) is what makes the
   read/unread state follow the client across devices and browsers. */
const {data:profile,error:profileError}=await supabaseClient
.from('profiles')
.select('full_name,phone,wallet_address,wallet_address_bep20,notifications_seen_at')
.eq('id',user.id)
.maybeSingle();

if(profileError){
console.error('Profile load error:',profileError);
}

currentProfile=profile||null;

/*
Use profile name first.
If profile is missing, use the name stored
inside Supabase Auth user metadata.
*/

const profileName=profile?.full_name?.trim();
const metadataName=user.user_metadata?.full_name?.trim();

const displayName=profileName||metadataName||'Client';

$('welcomeName').textContent=displayName;
$('welcomeEmail').textContent=user.email||'—';
const avatarEl=$('dashAvatar');
if(avatarEl)avatarEl.textContent=(displayName.trim().charAt(0)||'C').toUpperCase();

/* ================= PROFILE SAFETY SYNC ================= */

/*
If Auth already contains the client's information,
make sure the profile row also contains it.
*/

const metadataPhone=user.user_metadata?.phone||'';
const metadataWallet=user.user_metadata?.wallet_address||'';
const metadataWalletBep20=user.user_metadata?.wallet_address_bep20||'';

if(
user.id &&
(
!profile ||
!profile.full_name ||
!profile.phone ||
!profile.wallet_address ||
(profile.wallet_address_bep20!==metadataWalletBep20 && metadataWalletBep20)
)
){

try{

const profileUpdate={};

if(metadataName)profileUpdate.full_name=metadataName;
if(metadataPhone)profileUpdate.phone=metadataPhone;
if(metadataWallet)profileUpdate.wallet_address=metadataWallet;
if(metadataWalletBep20)profileUpdate.wallet_address_bep20=metadataWalletBep20;

if(Object.keys(profileUpdate).length>0){

const {error:syncError}=await supabaseClient
.from('profiles')
.update(profileUpdate)
.eq('id',user.id);

if(syncError){
console.error('Profile sync error:',syncError);
}else{

/* Refresh profile after successful sync */

const {data:updatedProfile}=await supabaseClient
.from('profiles')
.select('full_name,phone,wallet_address,wallet_address_bep20,notifications_seen_at')
.eq('id',user.id)
.maybeSingle();

if(updatedProfile){
currentProfile=updatedProfile;

const updatedName=updatedProfile.full_name?.trim()||displayName;

$('welcomeName').textContent=updatedName;
}

}

}

}catch(syncErr){
console.error('Profile safety sync error:',syncErr);
}

}

/* ================= ACCOUNT ================= */

const {data:accounts,error:accountError}=await supabaseClient
.from('accounts')
.select('balance,initial_balance,profit,first_deposit_at,total_withdrawn')
.eq('user_id',user.id)
.limit(1);

if(accountError){
console.error('Account load error:',accountError);
}

const a=accounts?.[0]||null;

currentAccount=a;

await renderAccountSummary(a);

await loadRequests();

await loadNotifications();

}catch(err){

console.error('Dashboard error:',err);

}

}

/* -------------------------- 14. Available-to-withdraw calculation (incl. pending withdrawals) -------------------------- */

/*
Sums this user's currently PENDING withdrawal requests.
This is the piece that closes the "double withdrawal" bug: without
subtracting pending requests, a client could submit multiple
withdrawal requests back-to-back, each individually looking valid
against the raw account balance/profit, but together exceeding what
was actually available. (E.g. $110 profit -> $50 pending withdrawal
still leaves the old getWithdrawableAmount() reporting $110
available, letting a second $110 withdrawal slip through when only
$60 was really left.)
*/
async function getPendingWithdrawalsTotal(){
if(!currentUser||!supabaseReady)return 0;
try{
const {data,error}=await supabaseClient
.from('withdrawals')
.select('amount')
.eq('user_id',currentUser.id)
.eq('status','pending');
if(error){console.error('Pending withdrawals fetch error:',error);return 0}
return (data||[]).reduce((sum,r)=>sum+Number(r.amount||0),0);
}catch(err){
console.error('Pending withdrawals fetch error:',err);
return 0;
}
}

/*
Available amount = (profit share, or full balance once principal is
unlocked) minus whatever is already sitting in pending withdrawal
requests. This is async (it queries Supabase), so every caller below
awaits it.
*/
async function getWithdrawableAmount(){
if(!currentAccount)return 0;
const balance=Number(currentAccount.balance||0);
const profit=Number(currentAccount.profit||0);
const days=daysSince(currentAccount.first_deposit_at);
const principalUnlocked=days!==null&&days>=PRINCIPAL_LOCK_DAYS;
const rawAvailable=principalUnlocked?balance:Math.min(profit,balance);
const pending=await getPendingWithdrawalsTotal();
return Math.max(0,rawAvailable-pending);
}

function daysSince(dateStr){
if(!dateStr)return null;
const then=new Date(dateStr).getTime();
return (Date.now()-then)/86400000;
}

/* -------------------------- 15. Account summary rendering (balance, profit, unlock progress) -------------------------- */
async function renderAccountSummary(a){
const balance=Number(a?.balance||0);
const deposit=Number(a?.initial_balance||0);
const profit=Number(a?.profit||0);
const withdrawn=Number(a?.total_withdrawn||0);

$('dashBalance').textContent='$'+balance.toFixed(2);
$('dashDeposit').textContent='$'+deposit.toFixed(2);
$('dashWithdrawn').textContent='$'+withdrawn.toFixed(2);

const profitEl=$('dashProfit');
const profitSubEl=$('dashProfitSub');
const pillEl=$('dashProfitPill');
profitEl.textContent=(profit<0?'-':'')+'$'+Math.abs(profit).toFixed(2);
profitEl.classList.remove('up','down');
pillEl.classList.remove('pos','neg','zero');
if(profit>0){
profitEl.classList.add('up');
pillEl.classList.add('pos');
pillEl.textContent='+$'+profit.toFixed(2)+' profit so far';
if(profitSubEl)profitSubEl.textContent="You're up since you joined";
}else if(profit<0){
profitEl.classList.add('down');
pillEl.classList.add('neg');
pillEl.textContent='-$'+Math.abs(profit).toFixed(2)+' loss so far';
if(profitSubEl)profitSubEl.textContent='Down since you joined';
}else{
pillEl.classList.add('zero');
pillEl.textContent='No profit or loss yet';
if(profitSubEl)profitSubEl.textContent='Nothing to report yet';
}

/* Available to withdraw + principal unlock countdown */
currentAccount=a;
const available=await getWithdrawableAmount();
$('dashAvailable').textContent='$'+available.toFixed(2);

const days=daysSince(a?.first_deposit_at);
const fillEl=$('unlockFill');
const daysTextEl=$('unlockDaysText');
const noteEl=$('unlockNote');

if(days===null){
fillEl.style.width='0%';
fillEl.classList.remove('done');
daysTextEl.textContent='No deposit yet';
noteEl.textContent='Once you make your first deposit, it unlocks for withdrawal after 40 days. Your profit can be withdrawn any time before that.';
}else if(days>=PRINCIPAL_LOCK_DAYS){
fillEl.style.width='100%';
fillEl.classList.add('done');
daysTextEl.textContent='Unlocked ✅';
noteEl.textContent='Your deposited amount is fully unlocked — your whole balance is available to withdraw.';
}else{
const pct=Math.max(0,Math.min(100,(days/PRINCIPAL_LOCK_DAYS)*100));
const daysLeft=Math.max(0,Math.ceil(PRINCIPAL_LOCK_DAYS-days));
fillEl.style.width=pct.toFixed(0)+'%';
fillEl.classList.remove('done');
daysTextEl.textContent=daysLeft+' day'+(daysLeft===1?'':'s')+' left';
noteEl.textContent='Your deposited amount unlocks in '+daysLeft+' day'+(daysLeft===1?'':'s')+'. Your profit share is available to withdraw right now.';
}
}

/* -------------------------- 16. Withdrawal fee calculator (UI) -------------------------- */
function updateWithdrawalCalc(){
const amtInput=$('withdrawalAmount');
const calc=$('withdrawalCalc');
if(!amtInput||!calc)return;
const amt=Number(amtInput.value);
if(!Number.isFinite(amt)||amt<=0){calc.style.display='none';return}
const fee=WITHDRAWAL_FEE;
const net=Math.max(0,amt-fee);
$('calcAmount').textContent='$'+amt.toFixed(2);
$('calcFee').textContent='$'+fee.toFixed(2);
$('calcReceive').textContent='$'+net.toFixed(2);
calc.style.display='block';
}

/* -------------------------- 17. Deposit / Withdrawal request modals (open/close) -------------------------- */
async function openRequest(type){
clearRequestMessages();
const id=type==='deposit'?'depositModal':'withdrawalModal';
const m=$(id);
if(!m)return;
if(type==='deposit'){
selectDepositNetwork(selectedDepositNetwork);
}
if(type==='withdrawal'){
selectWithdrawalNetwork(selectedWithdrawalNetwork);
const avail=await getWithdrawableAmount();
const days=daysSince(currentAccount?.first_deposit_at);
const principalUnlocked=days!==null&&days>=PRINCIPAL_LOCK_DAYS;
const noteEl=$('withdrawalAvailable');
if(noteEl){
if(principalUnlocked){
noteEl.textContent='Your principal is unlocked. You can withdraw up to $'+avail.toFixed(2)+' now.';
}else{
const daysLeft=Math.max(0,Math.ceil(PRINCIPAL_LOCK_DAYS-(days||0)));
noteEl.textContent='You can withdraw up to $'+avail.toFixed(2)+' now (your profit share, after accounting for any pending requests). Your deposited capital unlocks in '+daysLeft+' day'+(daysLeft===1?'':'s')+'.';
}
noteEl.style.display='block';
}
updateWithdrawalCalc();
}
m.classList.add('show');
document.body.classList.add('modal-open');
setTimeout(()=>{
const e=$(type==='deposit'?'depositAmount':'withdrawalAmount');
if(e)e.focus();
},50);
}

function closeRequest(type){
const m=$(type==='deposit'?'depositModal':'withdrawalModal');
if(m)m.classList.remove('show');
document.body.classList.remove('modal-open');
}

function clearRequestMessages(){
['depositMsg','withdrawalMsg'].forEach(id=>{
const e=$(id);
if(e)e.classList.remove('show');
});
}

/* -------------------------- 18. Submit deposit request -------------------------- */
async function submitDeposit(){
clearRequestMessages();
if(!supabaseReady){showMsg('depositMsg','Connection is not ready. Please refresh the page and try again.');return}
if(!currentUser){showMsg('depositMsg','Please login again.');return}
const amount=Number($('depositAmount').value);
const tx=$('depositTx').value.trim();
const proofFile=$('depositProof')?.files?.[0]||null;
if(!Number.isFinite(amount)||amount<100){showMsg('depositMsg','Minimum deposit is $100.');return}
if(!tx){showMsg('depositMsg','Please enter the transaction hash.');return}
if(!proofFile){showMsg('depositMsg','Please upload a screenshot of your payment.');return}
if(proofFile.size>5*1024*1024){showMsg('depositMsg','Screenshot must be under 5MB.');return}
const button=$('depositModal').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Submitting...'}
try{
let proofUrl=null;
const ext=proofFile.name.split('.').pop();
const path=currentUser.id+'/'+Date.now()+'.'+ext;
const {error:uploadError}=await supabaseClient.storage.from('deposit-proofs').upload(path,proofFile);
if(uploadError){console.error(uploadError);showMsg('depositMsg','Screenshot upload failed: '+uploadError.message);return}
const {data:urlData}=supabaseClient.storage.from('deposit-proofs').getPublicUrl(path);
proofUrl=urlData?.publicUrl||null;
const {error}=await supabaseClient.from('deposits').insert({
user_id:currentUser.id,amount,currency:'USDT',network:selectedDepositNetwork,tx_hash:tx,status:'pending',proof_url:proofUrl
});
if(error){console.error(error);showMsg('depositMsg',error.message);return}
showMsg('depositMsg','Deposit request submitted successfully. It is pending verification.',false);
$('depositAmount').value='';
$('depositTx').value='';
$('depositProof').value='';
$('depositProofName').textContent='';
await loadRequests();
await loadNotifications();
setTimeout(()=>closeRequest('deposit'),1200);
}catch(err){console.error(err);showMsg('depositMsg','Unable to submit deposit request right now.')}
finally{if(button){button.disabled=false;button.textContent='Submit deposit request'}}
}

/* -------------------------- 19. Submit withdrawal request -------------------------- */
async function submitWithdrawal(){
clearRequestMessages();
if(!supabaseReady){showMsg('withdrawalMsg','Connection is not ready. Please refresh the page and try again.');return}
if(!currentUser){showMsg('withdrawalMsg','Please login again.');return}
const amount=Number($('withdrawalAmount').value);
const wallet=$('withdrawalWallet').value.trim();
const network=selectedWithdrawalNetwork;

if(!Number.isFinite(amount)||amount<=WITHDRAWAL_FEE){showMsg('withdrawalMsg','Withdrawal amount must be greater than the $'+WITHDRAWAL_FEE.toFixed(2)+' fee.');return}

if(network==='TRC20'){
if(!validWallet(wallet)){showMsg('withdrawalMsg','Please enter a valid TRC20 wallet address starting with T.');return}
}else{
if(!validBep20Wallet(wallet)){showMsg('withdrawalMsg','Please enter a valid BEP20 wallet address starting with 0x.');return}
}

const {data:accounts,error:accountError}=await supabaseClient.from('accounts').select('balance,profit,first_deposit_at').eq('user_id',currentUser.id).limit(1);
if(accountError){showMsg('withdrawalMsg',accountError.message);return}
currentAccount=accounts?.[0]||currentAccount;
const balance=Number(currentAccount?.balance||0);
if(amount>balance){showMsg('withdrawalMsg','Withdrawal amount is higher than your available balance of $'+balance.toFixed(2)+'.');return}

/*
Re-checks pending withdrawals fresh, right before insert, via
getWithdrawableAmount() (which itself queries the withdrawals
table). This closes the double-withdrawal bug: a second submission
made right after a first pending one now correctly sees the first
as "reserved" and can no longer double-spend the same profit/balance.
This is still a client-side guard only — it is paired with a
DB-level trigger (check_withdrawal_amount, in the SQL) so the check
can't be bypassed by calling the API directly.
*/
const maxWithdrawable=await getWithdrawableAmount();
if(amount>maxWithdrawable){
const days=daysSince(currentAccount?.first_deposit_at);
const daysLeft=Math.max(0,Math.ceil(PRINCIPAL_LOCK_DAYS-(days||0)));
if(maxWithdrawable<=0){
showMsg('withdrawalMsg','You have no available balance to withdraw right now — you may already have a pending withdrawal request awaiting review.');
}else{
showMsg('withdrawalMsg','You can currently withdraw up to $'+maxWithdrawable.toFixed(2)+' (after accounting for any pending requests). Your deposited capital unlocks in '+daysLeft+' day'+(daysLeft===1?'':'s')+'.');
}
return;
}
const fee=WITHDRAWAL_FEE;
const netAmount=Math.max(0,amount-fee);
const button=$('withdrawalModal').querySelector('.form-actions .btn');
if(button){button.disabled=true;button.textContent='Submitting...'}
try{
const {error}=await supabaseClient.from('withdrawals').insert({
user_id:currentUser.id,amount,wallet_address:wallet,network:network,status:'pending'
});
if(error){console.error(error);showMsg('withdrawalMsg',error.message);return}
showMsg('withdrawalMsg','Withdrawal request submitted successfully. It is pending review. You will receive $'+netAmount.toFixed(2)+' after the $'+fee.toFixed(2)+' fee.',false);
$('withdrawalAmount').value='';
$('withdrawalCalc').style.display='none';
await loadRequests();
await loadNotifications();
setTimeout(()=>closeRequest('withdrawal'),1800);
}catch(err){console.error(err);showMsg('withdrawalMsg','Unable to submit withdrawal request right now.')}
finally{if(button){button.disabled=false;button.textContent='Submit withdrawal request'}}
}

/* -------------------------- 20. Recent transactions list -------------------------- */
async function loadRequests(){
if(!currentUser||!supabaseReady||!$('requestList'))return;
try{
const [d,w]=await Promise.all([
supabaseClient.from('deposits').select('amount,status,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(5),
supabaseClient.from('withdrawals').select('amount,status,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(5)
]);
const rows=[];
(d.data||[]).forEach(x=>rows.push({type:'Deposit',amount:x.amount,status:x.status,date:x.created_at}));
(w.data||[]).forEach(x=>rows.push({type:'Withdrawal',amount:x.amount,status:x.status,date:x.created_at}));
rows.sort((a,b)=>new Date(b.date)-new Date(a.date));
const el=$('requestList');
if(!rows.length){el.innerHTML='<div class="tx-empty">No deposits or withdrawals yet.</div>';return}
const statusWord={pending:'Pending review',approved:'Approved',rejected:'Rejected'};
el.innerHTML=rows.slice(0,8).map(x=>{
const isDeposit=x.type==='Deposit';
const statusKey=String(x.status).toLowerCase();
const statusLabel=statusWord[statusKey]||String(x.status);
return '<div class="tx-card">'
+'<div class="tx-icon '+(isDeposit?'dep':'wd')+'">'+(isDeposit?'⬇':'⬆')+'</div>'
+'<div class="tx-mid"><div class="tx-type">'+x.type+'</div><div class="tx-date">'+new Date(x.date).toLocaleString()+'</div></div>'
+'<div class="tx-right"><div class="tx-amount">'+(isDeposit?'+':'-')+'$'+Number(x.amount).toFixed(2)+'</div><span class="tx-status status-'+statusKey+'">'+statusLabel+'</span></div>'
+'</div>';
}).join('');
}catch(err){console.error('Requests error:',err)}
}

/* -------------------------- 21. Notification bell + popup (server-synced read state) -------------------------- */

/*
There is no dedicated notifications table — the feed is built by
combining the client's own deposits, withdrawals and profit_entries
rows into one timeline, newest first.

"Read" state used to be tracked locally per-browser (localStorage), which
meant switching device or browser made every old notification look
unread again. It is now tracked server-side instead, via the
profiles.notifications_seen_at column: "Mark all as read" writes the
current timestamp to that column, and unread/read is computed by
comparing each notification's date against it. This follows the client
across devices/browsers, and only genuinely NEW notifications (created
after the last "seen" timestamp) show up as unread.
*/

async function loadNotifications(){
if(!currentUser||!supabaseReady)return;
try{
const [d,w,p]=await Promise.all([
supabaseClient.from('deposits').select('amount,status,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10),
supabaseClient.from('withdrawals').select('amount,status,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10),
supabaseClient.from('profit_entries').select('client_share,entry_date,created_at').eq('user_id',currentUser.id).order('created_at',{ascending:false}).limit(10)
]);

const items=[];

(d.data||[]).forEach(x=>{
const statusText=x.status==='pending'?'Deposit request received':x.status==='approved'?'Deposit approved':'Deposit rejected';
const icon=x.status==='approved'?'✅':x.status==='rejected'?'❌':'📥';
items.push({icon,text:statusText+' — $'+Number(x.amount).toFixed(2),date:x.created_at});
});

(w.data||[]).forEach(x=>{
const statusText=x.status==='pending'?'Withdrawal request received':x.status==='approved'?'Withdrawal approved':'Withdrawal rejected';
const icon=x.status==='approved'?'💸':x.status==='rejected'?'❌':'⏳';
items.push({icon,text:statusText+' — $'+Number(x.amount).toFixed(2),date:x.created_at});
});

(p.data||[]).forEach(x=>{
items.push({icon:'📈',text:'Daily profit updated — +$'+Number(x.client_share||0).toFixed(2),date:x.created_at||x.entry_date});
});

items.sort((a,b)=>new Date(b.date)-new Date(a.date));

/* Kept around (module-level) so a click on a row can look itself up by
   index and open its own detail popup — see openNotifDetail(). */
currentNotificationItems=items.slice(0,20);

renderNotifications(currentNotificationItems);

}catch(err){
console.error('Notifications load error:',err);
}
}

function renderNotifications(items){
const list=$('notifList');
const badge=$('notifBadge');
if(!list)return;

/* Server-side "last seen" timestamp, from the client's profile row —
   replaces the old per-browser localStorage timestamp. */
const seenRaw=currentProfile?.notifications_seen_at;
const seenTime=seenRaw?new Date(seenRaw).getTime():0;

const unreadCount=items.filter(x=>new Date(x.date).getTime()>seenTime).length;

if(badge){
if(unreadCount>0){
badge.textContent=unreadCount>9?'9+':String(unreadCount);
badge.style.display='flex';
}else{
badge.style.display='none';
}
}

if(!items.length){
list.innerHTML='<div class="notif-empty">No notifications yet.</div>';
return;
}

const now=new Date();
const todayStr=now.toDateString();
const yestStr=new Date(now.getTime()-86400000).toDateString();

const groups={Today:[],Yesterday:[],Earlier:[]};

items.forEach(x=>{
const dStr=new Date(x.date).toDateString();
if(dStr===todayStr)groups.Today.push(x);
else if(dStr===yestStr)groups.Yesterday.push(x);
else groups.Earlier.push(x);
});

let html='';

Object.keys(groups).forEach(label=>{
const rows=groups[label];
if(!rows.length)return;
html+='<div class="notif-group-label">'+label+'</div>';
rows.forEach(x=>{
const isUnread=new Date(x.date).getTime()>seenTime;
const idx=items.indexOf(x);
html+='<div class="notif-item'+(isUnread?' unread':'')+'" onclick="openNotifDetail('+idx+')">'
+'<div class="notif-icon">'+x.icon+'</div>'
+'<div class="notif-body"><div class="notif-text">'+x.text+'</div><div class="notif-time">'+new Date(x.date).toLocaleString()+'</div></div>'
+'</div>';
});
});

list.innerHTML=html;
}

/* Opens/closes the small centered popup (+ its dim backdrop). Reloads
   the feed each time it opens so a freshly-arrived notification is
   reflected immediately. */
function toggleNotifications(){
const dd=$('notifDropdown');
const overlay=$('notifOverlay');
if(!dd)return;
const willShow=!dd.classList.contains('show');
dd.classList.toggle('show',willShow);
overlay?.classList.toggle('show',willShow);
document.body.classList.toggle('modal-open',willShow);
if(willShow)loadNotifications();
}

function closeNotifications(){
$('notifDropdown')?.classList.remove('show');
$('notifOverlay')?.classList.remove('show');
$('notifDetailModal')?.classList.remove('show');
document.body.classList.remove('modal-open');
}

/*
Opens one notification's own small popup on top of the list (X button to
close), so a client can read a single notification in full without the
list closing behind it. Mark all as read still works independently of this.
*/
function openNotifDetail(index){
const item=currentNotificationItems[index];
if(!item)return;
const iconEl=$('notifDetailIcon');
const textEl=$('notifDetailText');
const timeEl=$('notifDetailTime');
if(iconEl)iconEl.textContent=item.icon;
if(textEl)textEl.textContent=item.text;
if(timeEl)timeEl.textContent=new Date(item.date).toLocaleString();
$('notifDetailModal')?.classList.add('show');
}

function closeNotifDetail(){
$('notifDetailModal')?.classList.remove('show');
}

/* The dim backdrop behind the notification popup is shared by both the
   list and the single-notification detail popup. Clicking it should only
   close whichever layer is currently on top. */
function handleNotifOverlayClick(){
const detail=$('notifDetailModal');
if(detail&&detail.classList.contains('show')){
closeNotifDetail();
}else{
closeNotifications();
}
}

/*
Persists the "seen" timestamp to the client's profile row in Supabase
(instead of localStorage), so read state is shared across every device
and browser the client logs in from. Also flips the UI instantly and
locally — unread items lose their bold weight and highlight right
away — without waiting for a full reload.
*/
async function markAllNotificationsRead(){
if(!currentUser||!supabaseReady)return;
const now=new Date().toISOString();
try{
const {error}=await supabaseClient
.from('profiles')
.update({notifications_seen_at:now})
.eq('id',currentUser.id);
if(error){console.error('Mark notifications read error:',error);return}
}catch(err){
console.error('Mark notifications read error:',err);
return;
}
if(currentProfile)currentProfile.notifications_seen_at=now;
else currentProfile={notifications_seen_at:now};
const badge=$('notifBadge');
if(badge)badge.style.display='none';
document.querySelectorAll('.notif-item.unread').forEach(el=>el.classList.remove('unread'));
}

/* -------------------------- 22. Contact form submission -------------------------- */
/* CONTACT FORM — direct Supabase submission with optional attachment */
async function submitContact(event){
event.preventDefault();

const btn=$('contactSubmitBtn');
const name=$('contactName').value.trim();
const email=$('contactEmail').value.trim();
const subject=$('contactSubject').value.trim();
const message=$('contactMessage').value.trim();
const attachmentFile=$('contactAttachment')?.files?.[0]||null;

if(!name||!email||!subject||!message){
alert('Please fill all fields.');
return;
}

if(attachmentFile&&attachmentFile.size>5*1024*1024){
alert('Attachment must be under 5MB.');
return;
}

if(!supabaseReady){
alert('Connection is not ready. Please refresh the page and try again.');
return;
}

if(btn){btn.disabled=true;btn.textContent='Sending...'}

try{
let attachmentUrl=null;

if(attachmentFile){
const ext=attachmentFile.name.split('.').pop();
const path='contact/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
const {error:uploadError}=await supabaseClient.storage.from('contact-attachments').upload(path,attachmentFile);
if(uploadError){
console.error(uploadError);
alert('Attachment upload failed: '+uploadError.message);
if(btn){btn.disabled=false;btn.textContent='Submit'}
return;
}
const {data:urlData}=supabaseClient.storage.from('contact-attachments').getPublicUrl(path);
attachmentUrl=urlData?.publicUrl||null;
}

const {error}=await supabaseClient.from('contact_messages').insert({
name,email,subject,message,attachment_url:attachmentUrl,status:'new'
});

if(error){
console.error(error);
alert('Unable to send message right now. Please email support.pipzone@gmail.com directly.');
return;
}

$('contactSuccess').style.display='block';
$('contactName').value='';
$('contactEmail').value='';
$('contactSubject').value='';
$('contactMessage').value='';
$('contactAttachment').value='';
$('contactAttachmentName').textContent='';

setTimeout(()=>{$('contactSuccess').style.display='none'},5000);

}catch(err){
console.error(err);
alert('Unable to send message right now. Please email support.pipzone@gmail.com directly.');
}finally{
if(btn){btn.disabled=false;btn.textContent='Submit'}
}
}

/* -------------------------- 23. Logout -------------------------- */
async function logout(){
if(supabaseReady)await supabaseClient.auth.signOut();
location.reload();
}

/* -------------------------- 24. Profit-split calculator (homepage widget) -------------------------- */
function updateCalculator(){
const slider=$('amtSlider');
if(!slider)return;
const v=Number(slider.value);
$('amtOut').textContent=v.toLocaleString();
$('outResult').textContent=(v<0?'-':'')+'$'+Math.abs(v).toFixed(2);
$('outClient').textContent=(v<0?'-':'')+'$'+Math.abs(v*.6).toFixed(2);
$('outMgr').textContent=(v<0?'-':'')+'$'+Math.abs(v*.4).toFixed(2);
}

/* -------------------------- 25. Page bootstrap / event listeners -------------------------- */
document.addEventListener('DOMContentLoaded',async function(){
if(!initSupabase())return;
updateCalculator();
loadLiveStats();
selectDepositNetwork('TRC20');

const slider=$('amtSlider');
if(slider)slider.addEventListener('input',updateCalculator);

const proofInput=$('depositProof');
if(proofInput)proofInput.addEventListener('change',()=>{
const f=proofInput.files?.[0];
$('depositProofName').textContent=f?f.name:'';
});

const attachmentInput=$('contactAttachment');
if(attachmentInput)attachmentInput.addEventListener('change',()=>{
const f=attachmentInput.files?.[0];
$('contactAttachmentName').textContent=f?f.name:'';
});

const wAmtInput=$('withdrawalAmount');
if(wAmtInput)wAmtInput.addEventListener('input',updateWithdrawalCalc);

document.querySelectorAll('.faq-q').forEach(q=>q.addEventListener('click',()=>q.parentElement.classList.toggle('open')));

document.querySelectorAll('#loginForm input,#signupForm input,#resetPasswordForm input,#newPasswordForm input').forEach(input=>input.addEventListener('keydown',e=>{
if(e.key==='Enter'){
e.preventDefault();
if($('loginForm').style.display!=='none'){login()}
else if($('signupForm').style.display!=='none'){signup()}
else if($('resetPasswordForm').style.display!=='none'){sendResetEmail()}
else if($('newPasswordForm').style.display!=='none'){updatePassword()}
}
}));

supabaseClient.auth.onAuthStateChange((event,session)=>{
if(event==='PASSWORD_RECOVERY'){
setTimeout(()=>{showNewPasswordForm()},0);
}
});

document.addEventListener('keydown',e=>{
if(e.key==='Escape'){
if(modal.classList.contains('show'))closeAuth();
if($('depositModal')?.classList.contains('show'))closeRequest('deposit');
if($('withdrawalModal')?.classList.contains('show'))closeRequest('withdrawal');
if($('notifDetailModal')?.classList.contains('show')){closeNotifDetail()}
else{closeNotifications()}
}
});

document.querySelectorAll('.modal,.request-modal').forEach(m=>m.addEventListener('click',e=>{
if(e.target!==m)return;
if(m.id==='authModal')closeAuth();
if(m.id==='depositModal')closeRequest('deposit');
if(m.id==='withdrawalModal')closeRequest('withdrawal');
}));

try{
const {data}=await supabaseClient.auth.getSession();
const recoveryHash=window.location.hash.includes('type=recovery');
const recoverySearch=window.location.search.includes('type=recovery');
const isRecovery=recoveryHash||recoverySearch;
if(isRecovery&&data?.session){showNewPasswordForm()}
else if(data?.session){await loadDashboard()}
}catch(err){console.error('Session check error:',err)}
});
