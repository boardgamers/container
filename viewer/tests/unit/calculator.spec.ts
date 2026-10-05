import Calculator from '@/components/Calculator.vue';
import { shallowMount } from '@vue/test-utils';
import { expect } from 'chai';

describe('Calculator.vue', () => {
    it('accumulates digits and emits the bid', () => {
        const wrapper = shallowMount(Calculator);
        const vm = wrapper.vm as any;

        vm.add(1);
        vm.add(2);
        expect(vm.value).to.equal(12);

        vm.del();
        expect(vm.value).to.equal(1);

        vm.bid();
        expect(wrapper.emitted().bid![0]).to.deep.equal([1]);
        expect(vm.value).to.equal(0);
    });
    it('prefills a revision and replaces it when entering a new amount', () => {
        const wrapper = shallowMount(Calculator, { propsData: { initialValue: 12 } });
        const vm = wrapper.vm as any;
        expect(vm.value).to.equal(12);
        vm.add(8);
        expect(vm.value).to.equal(8);
        vm.add(5);
        vm.bid();
        expect(wrapper.emitted().bid![0]).to.deep.equal([85]);
        wrapper.destroy();
    });
    it('can submit the unchanged bid or backspace the prefilled value', () => {
        const wrapper = shallowMount(Calculator, { propsData: { initialValue: 12 } });
        const vm = wrapper.vm as any;
        vm.del();
        expect(vm.value).to.equal(1);
        vm.add(3);
        vm.bid();
        expect(wrapper.emitted().bid![0]).to.deep.equal([13]);
        wrapper.destroy();
    });
});
