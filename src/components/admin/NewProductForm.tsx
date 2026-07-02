import {
  Button,
  Card,
  Disclosure,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { createProduct } from "@/app/admin/actions";

export function NewProductForm() {
  return (
    <Card className="p-0">
      <Disclosure>
        <Disclosure.Heading>
          <Disclosure.Trigger className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left">
            <span className="text-sm font-semibold">新增商品</span>
            <Disclosure.Indicator />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body className="px-5 pb-5">
            <form action={createProduct}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField name="name" isRequired className="sm:col-span-2">
                  <Label>商品名称</Label>
                  <Input placeholder="例如：某某会员月卡" />
                </TextField>
                <TextField name="description" className="sm:col-span-2">
                  <Label>商品简介</Label>
                  <TextArea rows={3} placeholder="一句话描述，支持换行" />
                </TextField>
                <TextField
                  name="imageUrl"
                  type="url"
                  className="sm:col-span-2"
                >
                  <Label>商品图片链接（可留空，填 http(s) 开头的图片网址）</Label>
                  <Input placeholder="https://example.com/cover.png" />
                </TextField>
                <TextField name="usageNotes" className="sm:col-span-2">
                  <Label>使用说明 / 教程（买家付款后在订单页看到，可留空）</Label>
                  <TextArea
                    rows={4}
                    className="font-mono"
                    placeholder={
                      "1. 前往充值站 https://...\n2. 输入卡密与 Token\n3. 一键充值到你的账号"
                    }
                  />
                </TextField>
                <TextField name="priceYuan" type="number" isRequired>
                  <Label>价格（元）</Label>
                  <Input step="0.01" min="0" placeholder="9.90" />
                </TextField>
                <TextField name="sortOrder" type="number" defaultValue="0">
                  <Label>排序（小在前）</Label>
                  <Input />
                </TextField>
              </div>
              <Button type="submit" variant="primary" className="mt-5">
                添加商品
              </Button>
            </form>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </Card>
  );
}
