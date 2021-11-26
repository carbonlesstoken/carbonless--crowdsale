const { expect } = require('chai');
const { BN, expectEvent, expectRevert, makeInterfaceId, time } = require('@openzeppelin/test-helpers');
const { exitCode, hasUncaughtExceptionCaptureCallback } = require('process');
const EthCrypto = require("eth-crypto");
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const CRL = artifacts.require('CRL');
const CRLPresale = artifacts.require('CRLPresale');
const token = artifacts.require('token');

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);
const SIX = new BN(6);
const SEVEN = new BN(7);
const EIGHT = new BN(8);
const NINE = new BN(9);
const TEN = new BN(10);
const TWENTY = new BN(20);

const DECIMALS = new BN(18);
const ONE_TOKEN = TEN.pow(DECIMALS);
const TWO_TOKEN = ONE_TOKEN.mul(TWO);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

require('dotenv').config();
const {
    CRL_DECIMALS
} = process.env;

const ONE_CRL = TEN.pow(new BN(CRL_DECIMALS));

let signer;
let TOKENONE;
let CRLInst;
let CRLPresaleInst;

contract (
    'CRLPresale',
    ([
        deployer,
        admin,
        user1,
        user2,
        user3
    ]) => {

        let DEFAULT_ADMIN_ROLE;
        let MINTER_ROLE;

        beforeEach (async () => {

            signer = EthCrypto.createIdentity();

            TOKENONE = await token.new("TOKENONE", "TKNO");
            await TOKENONE.mint(user1, ONE_TOKEN.mul(new BN(100)));
            await TOKENONE.mint(user2, ONE_TOKEN.mul(new BN(100)));
            await TOKENONE.mint(user3, ONE_TOKEN.mul(new BN(100)));

            CRLInst = await CRL.new("CRL", "CRL");
            CRLPresaleInst = await CRLPresale.new(
                CRLInst.address, CRL_DECIMALS
            );

            await CRLInst.mint(CRLPresaleInst.address, ONE_CRL.mul(new BN(2000000000)));

            await TOKENONE.approve(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)), {from: user1});
            await TOKENONE.approve(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)), {from: user2});
            await TOKENONE.approve(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)), {from: user3});

            await CRLPresaleInst.grantRole(await CRLPresaleInst.DEFAULT_ADMIN_ROLE(), admin);
            await CRLPresaleInst.grantRole(await CRLPresaleInst.SIGNER_ROLE(), signer.address);
            await CRLPresaleInst.setPrice(new BN(589000));
            await CRLPresaleInst.addPaymentMethod("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE");
            await CRLPresaleInst.addPaymentMethod(TOKENONE.address);
            await CRLPresaleInst.renounceRole(await CRLPresaleInst.SIGNER_ROLE(), deployer);
            await CRLPresaleInst.renounceRole(await CRLPresaleInst.DEFAULT_ADMIN_ROLE(), deployer);
        })

        it('Valid signature and buying test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1});

            expect(await TOKENONE.balanceOf(user1)).bignumber.equal(ONE_TOKEN.mul(new BN(50)));

            let balance = new BN(await web3.eth.getBalance(user2)).toString();
            console.log(balance);

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy("0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user2, value: ONE_TOKEN.mul(new BN(50))});

            balance = new BN(await web3.eth.getBalance(user2)).toString();
            console.log(balance);

            expect(await CRLPresaleInst.amounts(user1, ZERO)).bignumber.equal(ONE_CRL.mul(new BN(100)));
            expect(await CRLPresaleInst.amounts(user2, ZERO)).bignumber.equal(ONE_CRL.mul(new BN(100)));

            expect(await CRLPresaleInst.amounts(user1, TWO)).bignumber.equal(ONE_TOKEN.mul(new BN(50)));
            expect(await CRLPresaleInst.amounts(user2, ONE)).bignumber.equal(ONE_TOKEN.mul(new BN(50)));
        })

        it('Invalid signature test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_CRL.mul(new BN(100)), ONE_TOKEN.mul(new BN(50)), deadline, signature, {from: user1}),
            "Invalid signature");

            await expectRevert(
                CRLPresaleInst.buy
                (user2, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1}),
            "Invalid signature");

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline.add(TEN), signature, {from: user1}),
            "Invalid signature");
        })

        it('Deadline test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await time.increase(time.duration.minutes(1));
            await time.increase(time.duration.seconds(1));

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1}), 
            "Signature deadline passed");
        })

        it('Different exceptions test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: "0" },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ZERO, ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1}), 
            "Cannot pay zero or receive less than one");

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.div(TEN).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.div(TEN), deadline, signature, {from: user1}), 
            "Cannot pay zero or receive less than one");

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1, value: ONE}),
            "Cannot send ETH while paying with token");

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(2000000000)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(2000000000)), deadline, signature, {from: user1});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL, deadline, signature, {from: user2}),
            "Cannot buy this much");
        })

        it('Times test', async () => {

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1}),
            "Already ended or not started");

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user2});

            await time.increase(time.duration.weeks(4));

            let firstTime = await CRLPresaleInst.endTime();

            await CRLPresaleInst.increaseEndTime(new BN(3600), {from: admin});

            let secondTime = await CRLPresaleInst.endTime();

            expect(secondTime).bignumber.equal(firstTime.add(new BN(3600)));

            await time.increaseTo(firstTime);
            await time.increase(time.duration.minutes(30));

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1});

            await time.increaseTo(secondTime);
            await time.increase(time.duration.seconds(1));

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await expectRevert(
                CRLPresaleInst.buy
                (TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user2}),
            "Already ended or not started");

            await expectRevert(CRLPresaleInst.increaseEndTime(new BN(3600), {from: admin}), "Already ended or not started");
        })

        it('Unsuccessful refund test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1});

            await expectRevert(CRLPresaleInst.refund({from: user1}), "Not ended yet");

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(999999900)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(999999900)), deadline, signature, {from: user2});

            expect(await CRLInst.balanceOf(user2)).bignumber.equal(ONE_CRL.mul(new BN(999999900)));
            expect(await CRLInst.balanceOf(user1)).bignumber.equal(ZERO);

            await expectRevert(CRLPresaleInst.refund({from: user1}), "Not ended yet");

            await time.increase(time.duration.days(120));
            await time.increase(time.duration.seconds(1));

            await expectRevert(CRLPresaleInst.refund({from: user1}), "Soft cap is reached");
        })

        it('Soft cap not reached all scenarios test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(100)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user1});
            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(100)), deadline, signature, {from: user2});

            let TOKENTWO = await token.new("TOKENTWO", "TKNT");
            await TOKENTWO.mint(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)));

            await expectRevert(CRLPresaleInst.getToken(CRLInst.address, {from: admin}), "Not ended yet");
            await CRLPresaleInst.getToken(TOKENONE.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENTWO.address, {from: admin});

            expect(await TOKENONE.balanceOf(CRLPresaleInst.address)).bignumber.equal(ONE_TOKEN.mul(new BN(100)));
            expect(await TOKENTWO.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);

            expect(await TOKENONE.balanceOf(admin)).bignumber.equal(ZERO);
            expect(await TOKENTWO.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(100)));

            await time.increase(time.duration.days(120));
            await time.increase(time.duration.seconds(1));

            await CRLPresaleInst.refund({from: user1});
            await CRLPresaleInst.redeem({from: user2});

            await TOKENTWO.mint(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)));

            await CRLPresaleInst.getToken(CRLInst.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENONE.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENTWO.address, {from: admin});

            expect(await CRLInst.balanceOf(admin)).bignumber.equal(ONE_CRL.mul(new BN(1999999900)));
            expect(await TOKENONE.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(50)));
            expect(await TOKENTWO.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(200)));

            expect(await CRLInst.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);
            expect(await TOKENONE.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);
            expect(await TOKENTWO.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);

            expect(await CRLInst.balanceOf(user1)).bignumber.equal(ZERO);
            expect(await CRLInst.balanceOf(user2)).bignumber.equal(ONE_CRL.mul(new BN(100)));
        })

        it('Soft cap reached all scenarios test', async () => {

            await CRLPresaleInst.start({from: admin});

            await time.advanceBlock();
            deadline = ((await time.latest()).add(new BN(60)));
            deadlinestr = deadline.toString();

            message = EthCrypto.hash.keccak256([
                { type: "address", value: TOKENONE.address },
                { type: "uint256", value: ONE_TOKEN.mul(new BN(50)).toString() },
                { type: "uint256", value: ONE_CRL.mul(new BN(500000000)).toString() },
                { type: "uint256", value: deadlinestr }
            ]);
            message = EthCrypto.hash.keccak256([
                { type: "string", value: "\x19Ethereum Signed Message:\n32" },
                { type: "bytes32", value: message }
            ]);
            signature = EthCrypto.sign(signer.privateKey, message);

            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(500000000)), deadline, signature, {from: user1});
            await CRLPresaleInst.buy(TOKENONE.address, ONE_TOKEN.mul(new BN(50)), ONE_CRL.mul(new BN(500000000)), deadline, signature, {from: user2});

            let TOKENTWO = await token.new("TOKENTWO", "TKNT");
            await TOKENTWO.mint(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)));

            await expectRevert(CRLPresaleInst.getToken(CRLInst.address, {from: admin}), "Not ended yet");
            await CRLPresaleInst.getToken(TOKENONE.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENTWO.address, {from: admin});

            expect(await TOKENONE.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);
            expect(await TOKENTWO.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);

            expect(await TOKENONE.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(100)));
            expect(await TOKENTWO.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(100)));

            expect(await CRLInst.balanceOf(user1)).bignumber.equal(ZERO);
            expect(await CRLInst.balanceOf(user2)).bignumber.equal(ONE_CRL.mul(new BN(500000000)));

            await time.increase(time.duration.days(120));
            await time.increase(time.duration.seconds(1));

            await expectRevert(CRLPresaleInst.refund({from: user1}), "Soft cap is reached");
            await CRLPresaleInst.redeem({from: user1});

            await TOKENTWO.mint(CRLPresaleInst.address, ONE_TOKEN.mul(new BN(100)));

            await CRLPresaleInst.getToken(CRLInst.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENONE.address, {from: admin});
            await CRLPresaleInst.getToken(TOKENTWO.address, {from: admin});

            expect(await CRLInst.balanceOf(admin)).bignumber.equal(ONE_CRL.mul(new BN(1000000000)));
            expect(await TOKENONE.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(100)));
            expect(await TOKENTWO.balanceOf(admin)).bignumber.equal(ONE_TOKEN.mul(new BN(200)));

            expect(await CRLInst.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);
            expect(await TOKENONE.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);
            expect(await TOKENTWO.balanceOf(CRLPresaleInst.address)).bignumber.equal(ZERO);

            expect(await CRLInst.balanceOf(user1)).bignumber.equal(ONE_CRL.mul(new BN(500000000)));
            expect(await CRLInst.balanceOf(user2)).bignumber.equal(ONE_CRL.mul(new BN(500000000)));
        })
    }
)